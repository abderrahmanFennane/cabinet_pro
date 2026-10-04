import { Router, Request, Response, NextFunction } from 'express';
import { copyDefaultActs } from '../services/cabinet-setup';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { hashPassword, sessionToken } from '../utils/auth';
import { randomInt } from 'crypto';
import { sendMessage } from '../services/messaging';
import { writeAuditLog } from '../utils/audit';
import { sendSuccess } from '../utils/response';
import { authenticate, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { assertSeatAvailable } from '../services/cabinet-setup';
import { SPECIALTIES } from '../types/permissions';

// Team management: the owner manages practitioners and assistants of their cabinet;
// the Super Admin manages owners and platform admins. Everyone can edit their own profile.
const router = Router();
router.use(authenticate);

const TEAM_ROLES = ['PRACTITIONER', 'ASSISTANT'] as const;

const baseFields = {
  email: z.string().trim().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  firstName: z.string().trim().min(1, 'Prénom requis'),
  lastName: z.string().trim().min(1, 'Nom requis'),
  title: z.string().trim().max(10).nullable().optional(),
  inpe: z.string().trim().max(20).nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  specialty: z.enum(SPECIALTIES).nullable().optional(),
  seesAllPatients: z.boolean().optional(),
};

const createSchema = z.object({ ...baseFields, role: z.enum(['SUPER_ADMIN', 'OWNER', 'PRACTITIONER', 'ASSISTANT']).default('ASSISTANT'), cabinetId: z.string().optional() });
const updateSchema = z.object({ ...baseFields, role: z.enum(['OWNER', 'PRACTITIONER', 'ASSISTANT']), isActive: z.boolean() }).partial();

const userInclude = { cabinet: { select: { id: true, name: true } } };

const serialize = (user: any) => ({
  id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, title: user.title, inpe: user.inpe, phone: user.phone,
  avatar: user.avatar, role: user.role, specialty: user.specialty, seesAllPatients: user.seesAllPatients, cabinetId: user.cabinetId,
  isActive: user.isActive, mfaEnabled: !!user.totpEnabledAt, createdAt: user.createdAt, cabinet: user.cabinet || null,
});

const isOwner = (req: Request) => req.user!.role === 'OWNER' && req.user!.permissions?.includes('MANAGE_TEAM');

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinetId = typeof req.query.cabinetId === 'string' ? req.query.cabinetId : undefined;
    const where: any = { deletedAt: null };
    if (req.user!.role === 'SUPER_ADMIN') {
      if (cabinetId) where.cabinetId = cabinetId;
    } else if (isOwner(req)) {
      where.cabinetId = req.user!.cabinetId;
    } else {
      throw new AppError('Permissions insuffisantes', 403);
    }
    const users = await prisma.user.findMany({ where, include: userInclude, orderBy: [{ role: 'asc' }, { lastName: 'asc' }] });
    const quotaCabinetId = where.cabinetId as string | undefined;
    const cabinet = quotaCabinetId ? await prisma.cabinet.findUnique({ where: { id: quotaCabinetId }, select: { plan: true, maxPractitioners: true, maxAssistants: true } }) : null;
    const plan = cabinet ? await prisma.plan.findUnique({ where: { code: cabinet.plan }, select: { code: true, name: true } }) : null;
    const meta = cabinet ? {
      quota: {
        plan: { code: cabinet.plan, name: plan?.name || cabinet.plan },
        practitioners: { used: users.filter(u => u.role === 'OWNER' || u.role === 'PRACTITIONER').length, limit: cabinet.maxPractitioners },
        assistants: { used: users.filter(u => u.role === 'ASSISTANT').length, limit: cabinet.maxAssistants },
      },
    } : undefined;
    sendSuccess(res, users.map(serialize), undefined, meta);
  } catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSchema.parse(req.body);
    if (req.user!.role === 'SUPER_ADMIN') {
      if (data.role !== 'SUPER_ADMIN' && !data.cabinetId) throw new AppError('Cabinet requis', 400);
      if (data.role === 'SUPER_ADMIN') data.cabinetId = undefined;
    } else if (isOwner(req)) {
      if (!(TEAM_ROLES as readonly string[]).includes(data.role)) throw new AppError('Vous ne pouvez créer que des praticiens et des assistants', 403);
      data.cabinetId = req.user!.cabinetId!;
    } else {
      throw new AppError('Permissions insuffisantes', 403);
    }

    const email = data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw new AppError('Cet email est déjà utilisé', 409);

    let specialty: string | null = data.specialty ?? null;
    if (data.cabinetId && (data.role === 'OWNER' || data.role === 'PRACTITIONER')) {
      const cabinet = await prisma.cabinet.findUnique({ where: { id: data.cabinetId }, select: { specialty: true } });
      specialty = specialty || cabinet?.specialty || 'GENERAL';
      // A second specialty in the same cabinet is a Clinique plan feature.
      if (cabinet && specialty !== cabinet.specialty && req.user!.role !== 'SUPER_ADMIN' && !req.user!.permissions?.includes('MULTI_SPECIALTY')) {
        throw new AppError('Plusieurs spécialités dans un cabinet nécessitent le plan Clinique', 403);
      }
    }
    if (data.role === 'ASSISTANT') specialty = null;

    const user = await prisma.$transaction(async (tx) => {
      if (data.cabinetId) await assertSeatAvailable(tx, data.cabinetId, data.role);
      // A doctor of a specialty the cabinet has no acts for yet: copy that specialty's default price list.
      if (data.cabinetId && specialty) await copyDefaultActs(tx, data.cabinetId, specialty);
      return tx.user.create({
        data: {
          email, password: await hashPassword(data.password), firstName: data.firstName, lastName: data.lastName,
          title: data.title ?? (data.role === 'ASSISTANT' || data.role === 'SUPER_ADMIN' ? null : 'Dr'), phone: data.phone,
          role: data.role, specialty, seesAllPatients: data.role === 'OWNER' ? true : data.seesAllPatients ?? false, cabinetId: data.cabinetId || null,
        },
        include: userInclude,
      });
    });
    sendSuccess(res, serialize(user), 'Utilisateur créé', undefined, 201);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateSchema.parse(req.body);
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) throw new AppError('Utilisateur non trouvé', 404);

    const self = existing.id === req.user!.id;
    if (req.user!.role !== 'SUPER_ADMIN') {
      const sameCabinetOwner = isOwner(req) && existing.cabinetId === req.user!.cabinetId;
      if (!self && !sameCabinetOwner) throw new AppError('Accès non autorisé', 403);
      if (self && (data.role || data.isActive === false || data.seesAllPatients !== undefined) && existing.role !== 'OWNER') {
        throw new AppError('Vous ne pouvez pas modifier ces champs', 403);
      }
      if (data.role && !(TEAM_ROLES as readonly string[]).includes(data.role)) throw new AppError('Rôle non autorisé', 403);
      if (self && existing.role === 'OWNER' && (data.role || data.isActive === false)) throw new AppError('Le titulaire ne peut pas modifier son propre rôle', 403);
    }

    if (data.email && data.email.toLowerCase() !== existing.email) {
      if (await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } })) throw new AppError('Cet email est déjà utilisé', 409);
    }
    if (data.role && data.role !== existing.role && existing.cabinetId) await assertSeatAvailable(prisma as any, existing.cabinetId, data.role);

    const update: any = { ...data };
    if (data.email) update.email = data.email.toLowerCase();
    if (data.password) update.password = await hashPassword(data.password);
    // A new password or a deactivation signs the account out of every device.
    const revoke = !!data.password || (data.isActive === false && existing.isActive);
    if (revoke) update.tokenVersion = { increment: 1 };
    const user = await prisma.user.update({ where: { id: existing.id }, data: update, include: userInclude });
    // Changing one's own password keeps this session open with a fresh token.
    sendSuccess(res, { ...serialize(user), ...(revoke && self ? { token: sessionToken(user) } : {}) }, 'Utilisateur mis à jour');
  } catch (err) { next(err); }
});

// Easy to read and dictate (no 0/O, 1/l/I), e.g. "Kmr-7tq4-Zp": same shape as the passwords made on screen.
const tempPassword = () => {
  const pick = (set: string) => set[randomInt(set.length)];
  const low = 'abcdefghjkmnpqrstuvwxyz23456789', up = 'ABCDEFGHJKMNPQRSTUVWXYZ', dig = '23456789';
  const chunk = (n: number) => Array.from({ length: n }, () => pick(low)).join('');
  return `${pick(up)}${chunk(2)}-${chunk(4)}-${pick(up)}${pick(dig)}`;
};

/**
 * Sends the login details again: a new temporary password (the old one is only stored hashed), every session
 * signed out, and the details sent by SMS when the account has a phone. The details are also returned once.
 */
router.post('/:id/resend-access', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel } = z.object({ channel: z.enum(['SMS', 'WHATSAPP', 'NONE']).default('SMS') }).parse(req.body ?? {});
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { cabinet: { select: { name: true } } } });
    if (!existing) throw new AppError('Utilisateur non trouvé', 404);
    if (existing.id === req.user!.id) throw new AppError('Changez votre propre mot de passe depuis Mon compte', 400);
    if (req.user!.role !== 'SUPER_ADMIN' && !(isOwner(req) && existing.cabinetId === req.user!.cabinetId && existing.role !== 'OWNER')) {
      throw new AppError('Accès non autorisé', 403);
    }
    const password = tempPassword();
    await prisma.user.update({ where: { id: existing.id }, data: { password: await hashPassword(password), tokenVersion: { increment: 1 }, isActive: true } });
    const loginUrl = `${(process.env.FRONTEND_URL || String(req.headers.origin || '')).replace(/\/$/, '')}/login`;
    let status: string | null = null;
    if (channel !== 'NONE' && existing.phone) {
      const sent = await sendMessage({
        kind: 'WELCOME', channel, toPhone: existing.phone, cabinetId: existing.cabinetId, toUserId: existing.id, fromUserId: req.user!.id,
        body: `Bonjour ${existing.firstName}, vos accès Cabinet Pro${existing.cabinet ? ` (${existing.cabinet.name})` : ''} : ${loginUrl} · Email : ${existing.email} · Mot de passe provisoire : ${password} (à changer à la première connexion).`,
      });
      status = sent?.status || 'FAILED';
    }
    void writeAuditLog({ userId: req.user!.id, cabinetId: existing.cabinetId, action: 'RESEND_ACCESS', method: req.method, path: req.originalUrl, status: 200 });
    sendSuccess(res, { email: existing.email, password, phone: existing.phone, cabinetName: existing.cabinet?.name ?? null, status },
      status === 'SENT' ? 'Nouveaux accès envoyés par SMS' : status === 'LOGGED' ? 'Nouveaux accès créés (envoi SMS non configuré : transmettez-les vous-même)'
        : status === 'FAILED' ? 'Nouveaux accès créés, mais l’envoi a échoué : transmettez-les vous-même' : 'Nouveaux accès créés');
  } catch (err) { next(err); }
});

/**
 * Super Admin: moves an account to another cabinet (a doctor changing practice, an account created in the wrong one).
 * Past consultations stay in the old cabinet under the doctor's name; future appointments must be moved first.
 */
router.post('/:id/move', requireRoles('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ cabinetId: z.string().min(1), role: z.enum(['OWNER', 'PRACTITIONER', 'ASSISTANT']).optional() }).parse(req.body);
    const user = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!user) throw new AppError('Utilisateur non trouvé', 404);
    if (user.role === 'SUPER_ADMIN') throw new AppError('Un Super Admin n’appartient à aucun cabinet', 400);
    if (user.cabinetId === body.cabinetId) throw new AppError('Ce compte est déjà dans ce cabinet', 400);
    const role = body.role || user.role;
    const target = await prisma.cabinet.findFirst({ where: { id: body.cabinetId, deletedAt: null }, select: { id: true, name: true } });
    if (!target) throw new AppError('Cabinet de destination introuvable', 404);

    if (user.cabinetId) {
      if (user.role === 'OWNER') {
        const owners = await prisma.user.count({ where: { cabinetId: user.cabinetId, role: 'OWNER', deletedAt: null, isActive: true, id: { not: user.id } } });
        if (!owners) throw new AppError('C’est le seul titulaire de son cabinet : nommez d’abord un autre titulaire.', 409);
      }
      const upcoming = await prisma.appointment.count({ where: { cabinetId: user.cabinetId, practitionerId: user.id, deletedAt: null, date: { gte: new Date() }, status: { in: ['PLANNED', 'CONFIRMED'] } } });
      if (upcoming) throw new AppError(`${upcoming} rendez-vous à venir avec ce médecin dans son cabinet actuel : déplacez-les ou annulez-les d’abord.`, 409);
    }

    const moved = await prisma.$transaction(async (tx) => {
      await assertSeatAvailable(tx as any, target.id, role);
      if (user.cabinetId) {
        // Their patients in the old cabinet keep their file, without a referring doctor who has left.
        await tx.patient.updateMany({ where: { cabinetId: user.cabinetId, primaryPractitionerId: user.id }, data: { primaryPractitionerId: null } });
      }
      return tx.user.update({ where: { id: user.id }, data: { cabinetId: target.id, role, tokenVersion: { increment: 1 } }, include: userInclude });
    });
    void writeAuditLog({ userId: req.user!.id, cabinetId: target.id, action: 'MOVE_USER', method: req.method, path: req.originalUrl, status: 200 });
    sendSuccess(res, serialize(moved), `Compte déplacé vers ${target.name}`);
  } catch (err) { next(err); }
});

/** Clears a lost authenticator: the user sets it up again at the next login. Super Admin, or the owner for their team. */
router.post('/:id/mfa/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) throw new AppError('Utilisateur non trouvé', 404);
    if (req.user!.role !== 'SUPER_ADMIN' && !(isOwner(req) && existing.cabinetId === req.user!.cabinetId && existing.id !== req.user!.id)) {
      throw new AppError('Accès non autorisé', 403);
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { totpSecret: null, totpEnabledAt: null, recoveryCodes: null, tokenVersion: { increment: 1 } },
    });
    sendSuccess(res, null, 'Double authentification réinitialisée');
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) throw new AppError('Utilisateur non trouvé', 404);
    if (existing.id === req.user!.id) throw new AppError('Vous ne pouvez pas supprimer votre propre compte', 400);
    if (req.user!.role !== 'SUPER_ADMIN' && !(isOwner(req) && existing.cabinetId === req.user!.cabinetId && existing.role !== 'OWNER')) {
      throw new AppError('Accès non autorisé', 403);
    }
    await prisma.user.update({ where: { id: existing.id }, data: { deletedAt: new Date(), isActive: false, tokenVersion: { increment: 1 }, email:`${existing.email}#deleted-${Date.now()}` } });
    sendSuccess(res, null, 'Utilisateur supprimé');
  } catch (err) { next(err); }
});

router.get('/admins', requireRoles('SUPER_ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, (await prisma.user.findMany({ where: { role: 'SUPER_ADMIN', deletedAt: null }, include: userInclude })).map(serialize));
  } catch (err) { next(err); }
});

export default router;
