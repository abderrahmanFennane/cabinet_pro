import { Request, Response, NextFunction } from 'express';
import { verifyToken, SessionPayload } from '../utils/auth';
import { prisma } from '../config/prisma';
import { writeAuditLog } from '../utils/audit';
import { canAccessCabinet, effectivePermissions, parsePermissionList } from '../utils/tenant-access';
import { ALL_PERMISSION_KEYS, PermissionKey } from '../types/permissions';

export type BlockedReason = 'TRIAL_ENDED' | 'PLAN_EXPIRED' | 'SUSPENDED';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        cabinetId?: string | null;
        specialty?: string | null;
        seesAllPatients?: boolean;
        permissions?: PermissionKey[];
        blocked?: BlockedReason | null;
        /** Set when a Super Admin works inside a cabinet (demo cabinet or support grant). */
        support?: { cabinetId: string; readOnly: boolean; demo: boolean } | null;
      };
    }
  }
}

// What a blocked cabinet can still reach: its profile, billing/renewal and its inbox.
const BLOCKED_ALLOWED = ['/api/auth/me', '/api/billing/subscription', '/api/billing/plans', '/api/billing/checkout', '/api/billing/invoices', '/api/messages/inbox'];

const BLOCKED_MESSAGES: Record<BlockedReason, string> = {
  TRIAL_ENDED: 'Votre essai gratuit est terminé.',
  PLAN_EXPIRED: 'Votre abonnement a expiré.',
  SUSPENDED: 'Le compte de votre cabinet est suspendu.',
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Already authenticated by a router mounted on the same prefix.
  if (req.user) return next();
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);
    else if (req.cookies?.token) token = req.cookies.token;
    else if (typeof req.query?.token === 'string' && req.query.token.length > 20) token = req.query.token;

    if (!token) {
      res.status(401).json({ error: 'Authentification requise' });
      return;
    }

    const payload = verifyToken(token) as SessionPayload;
    // The half-way token of the two-step login only opens /auth/mfa/*.
    if (payload.purpose === 'mfa') {
      res.status(401).json({ error: 'Code de vérification requis' });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null },
      select: {
        id: true, email: true, role: true, cabinetId: true, isActive: true, specialty: true, seesAllPatients: true, tokenVersion: true,
        cabinet: { select: { isActive: true, deletedAt: true, currentPeriodEnd: true, trialEndsAt: true, subscriptionStatus: true, plan: true } },
      },
    });
    // Password changed, account deactivated or "sign out everywhere": older tokens stop working.
    if (user && (payload.tv ?? 0) !== user.tokenVersion) {
      res.status(401).json({ error: 'Session expirée, reconnectez-vous', code: 'SESSION_REVOKED' });
      return;
    }

    const cabinet = user?.cabinet;
    const subscriptionExpired = !!(cabinet?.currentPeriodEnd && cabinet.currentPeriodEnd <= new Date());
    if (subscriptionExpired && cabinet?.isActive && user?.cabinetId) {
      await prisma.cabinet.update({ where: { id: user.cabinetId }, data: { isActive: false, subscriptionStatus: 'PAST_DUE' } });
    }
    if (!user || !user.isActive || (user.role !== 'SUPER_ADMIN' && (!cabinet || cabinet.deletedAt))) {
      res.status(401).json({ error: 'Compte invalide ou désactivé' });
      return;
    }

    let blocked: BlockedReason | null = null;
    if (user.role !== 'SUPER_ADMIN' && cabinet && (subscriptionExpired || !cabinet.isActive)) {
      const trialEnded = cabinet.subscriptionStatus === 'TRIALING'
        || (!!cabinet.trialEndsAt && !!cabinet.currentPeriodEnd && cabinet.trialEndsAt.getTime() >= cabinet.currentPeriodEnd.getTime() - 60_000);
      blocked = subscriptionExpired ? (trialEnded ? 'TRIAL_ENDED' : 'PLAN_EXPIRED') : 'SUSPENDED';
    }

    let planPermissions: PermissionKey[] | null = null;
    if (user.role !== 'SUPER_ADMIN' && cabinet?.plan) {
      const plan = await prisma.plan.findUnique({ where: { code: cabinet.plan }, select: { permissions: true } });
      planPermissions = plan ? parsePermissionList(plan.permissions) : null;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      cabinetId: user.cabinetId,
      specialty: user.specialty,
      seesAllPatients: user.role === 'OWNER' || user.seesAllPatients,
      permissions: effectivePermissions(user.role, planPermissions),
      blocked,
      support: null,
    };

    if (blocked && !BLOCKED_ALLOWED.some(path => req.originalUrl.startsWith(path))) {
      res.status(402).json({ error: BLOCKED_MESSAGES[blocked], code: 'CABINET_BLOCKED', reason: blocked });
      return;
    }

    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        void writeAuditLog({
          userId: req.user?.id,
          cabinetId: req.params.cabinetId || req.user?.cabinetId,
          action: `${req.method} ${req.route?.path || req.path}`,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
        });
      });
    }

    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

export const requireRoles = (...roles: string[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }
  if (!roles.includes(req.user.role)) {
    res.status(403).json({ error: 'Permissions insuffisantes' });
    return;
  }
  next();
};

export const requirePermissions = (...permissions: PermissionKey[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }
  const userPerms = req.user.permissions || [];
  const missing = permissions.filter(p => !userPerms.includes(p));
  if (missing.length) {
    res.status(403).json({ error: 'Permission refusée', missing });
    return;
  }
  next();
};

/**
 * Guards every /api/cabinets/:cabinetId/* data route.
 * Cabinet members reach only their own cabinet. The Super Admin reaches a cabinet only if it is the
 * demo cabinet, or through an unexpired support grant from its owner (read-only unless granted otherwise).
 */
export const requireCabinetAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }
  const cabinetId = req.params.cabinetId;
  const cabinet = cabinetId
    ? await prisma.cabinet.findUnique({ where: { id: cabinetId }, select: { isActive: true, deletedAt: true, isDemo: true } })
    : null;
  if (!cabinet || cabinet.deletedAt) {
    res.status(404).json({ error: 'Cabinet introuvable' });
    return;
  }

  if (req.user.role === 'SUPER_ADMIN') {
    if (cabinet.isDemo) {
      req.user.support = { cabinetId, readOnly: false, demo: true };
      req.user.seesAllPatients = true;
      req.user.permissions = [...ALL_PERMISSION_KEYS];
      return next();
    }
    const grant = await prisma.supportAccessGrant.findFirst({
      where: { cabinetId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!grant) {
      res.status(403).json({ error: 'Accès refusé : ce cabinet n’a pas autorisé d’accès support.', code: 'SUPPORT_ACCESS_REQUIRED' });
      return;
    }
    if (grant.readOnly && req.method !== 'GET') {
      res.status(403).json({ error: 'Accès support en lecture seule' });
      return;
    }
    req.user.support = { cabinetId, readOnly: grant.readOnly, demo: false };
    req.user.seesAllPatients = true;
    req.user.permissions = [...ALL_PERMISSION_KEYS];
    return next();
  }

  if (!canAccessCabinet(req.user.role, req.user.cabinetId, cabinetId)) {
    res.status(403).json({ error: 'Accès non autorisé à ce cabinet' });
    return;
  }
  if (!cabinet.isActive) {
    res.status(403).json({ error: 'Cabinet inactif' });
    return;
  }
  next();
};

/**
 * Medical content guard: refuses users without VIEW_MEDICAL and records the refused attempt
 * in the cabinet's access log (acceptance criterion: "la tentative est refusée et journalisée").
 */
export const requireMedicalAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.user?.permissions?.includes('VIEW_MEDICAL')) return next();
  const patientId = req.params.patientId;
  if (req.user && req.params.cabinetId && patientId) {
    await prisma.patientAccessLog.create({
      data: { cabinetId: req.params.cabinetId, patientId, userId: req.user.id, action: 'DENIED', detail: `${req.method} ${req.originalUrl}`.slice(0, 190) },
    }).catch(() => undefined);
  }
  res.status(403).json({ error: 'Accès au contenu médical refusé' });
};
