import { createHash, randomBytes, randomInt } from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { comparePassword, hashPassword, mfaRequiredFor, mfaToken, readMfaToken, sessionToken } from '../utils/auth';
import { rateLimit } from '../utils/rate-limit';
import { createInboxMessage, sendMessage } from '../services/messaging';
import { copyDefaultActs, planQuotas } from '../services/cabinet-setup';
import { sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { writeAuditLog } from '../utils/audit';
import { SPECIALTIES } from '../types/permissions';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

const registerSchema = z.object({
  cabinetName: z.string().trim().min(2, 'Nom du cabinet requis'),
  specialty: z.enum(SPECIALTIES).default('DENTISTRY'),
  city: z.string().trim().optional(),
  firstName: z.string().trim().min(1, 'Prénom requis'),
  lastName: z.string().trim().min(1, 'Nom requis'),
  email: z.string().trim().email('Email invalide'),
  phone: z.string().trim().min(6, 'Téléphone requis'),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
});

const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 3);
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Trop de tentatives. Réessayez dans quelques minutes.' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Trop d’inscriptions depuis cette connexion. Réessayez plus tard.' });

const publicUser = (user: { id: string; email: string; firstName: string; lastName: string; role: string; cabinetId: string | null }) => ({
  id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, cabinetId: user.cabinetId,
});

/** Self-service sign-up: creates the cabinet and its owner (médecin titulaire) with a free trial. */
router.post('/register', registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new AppError('Cet email est déjà utilisé. Connectez-vous.', 409);
    }
    const specialty = await prisma.specialty.findUnique({ where: { code: data.specialty } });
    if (specialty && !specialty.isActive) throw new AppError('Cette spécialité n’est pas encore disponible', 400);

    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const trialPlan = await prisma.plan.findUnique({ where: { code: process.env.TRIAL_PLAN_CODE || 'TRIAL' } });
    const password = await hashPassword(data.password);

    const { cabinet, user } = await prisma.$transaction(async (tx) => {
      const cabinet = await tx.cabinet.create({
        data: {
          name: data.cabinetName,
          city: data.city,
          phone: data.phone,
          email,
          specialty: data.specialty,
          plan: trialPlan?.code || 'TRIAL',
          subscriptionStatus: 'TRIALING',
          trialEndsAt: trialEnd,
          currentPeriodEnd: trialEnd,
          ...(trialPlan ? planQuotas(trialPlan) : {}),
        },
      });
      const user = await tx.user.create({
        data: { email, password, title: 'Dr', firstName: data.firstName, lastName: data.lastName, phone: data.phone, role: 'OWNER', specialty: data.specialty, seesAllPatients: true, cabinetId: cabinet.id },
      });
      await tx.subscriptionHistory.create({ data: { cabinetId: cabinet.id, plan: cabinet.plan, status: 'TRIALING', startedAt: new Date(), periodEnd: trialEnd } });
      await copyDefaultActs(tx, cabinet.id, data.specialty);
      return { cabinet, user };
    });

    await createInboxMessage({
      kind: 'WELCOME',
      toUserId: user.id,
      cabinetId: cabinet.id,
      subject: 'Bienvenue sur Cabinet Pro',
      body: `Votre essai gratuit de ${TRIAL_DAYS} jours est actif jusqu'au ${trialEnd.toLocaleDateString('fr-FR')}. Vérifiez vos tarifs d’actes, puis ajoutez vos premiers patients.`,
      fromName: 'Cabinet Pro',
    });
    void writeAuditLog({ userId: user.id, cabinetId: cabinet.id, action: 'REGISTER_TRIAL', method: req.method, path: req.originalUrl, status: 201 });

    const token = sessionToken({ ...user, cabinetId: cabinet.id });
    sendSuccess(res, { token, user: publicUser(user) }, 'Essai gratuit activé', undefined, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null }, include: { cabinet: { select: { isDemo: true } } } });

    if (!user || !(await comparePassword(password, user.password))) {
      void writeAuditLog({ action: 'LOGIN_FAILURE', method: req.method, path: req.originalUrl, status: 401 });
      throw new AppError('Identifiants invalides', 401);
    }
    if (!user.isActive) {
      throw new AppError('Votre compte est désactivé. Contactez le médecin titulaire.', 403);
    }
    // Blocked cabinets (trial ended, plan expired, suspended) can still sign in:
    // the app then shows the renewal / contact page instead of the workspace.

    // Second step: a code from the authenticator app, or its first-time setup.
    if (mfaRequiredFor(user)) {
      sendSuccess(res, { mfa: user.totpEnabledAt ? 'VERIFY' : 'SETUP', mfaToken: mfaToken(user) }, 'Code de vérification requis');
      return;
    }

    const token = sessionToken(user);
    void writeAuditLog({ userId: user.id, cabinetId: user.cabinetId, action: 'LOGIN_SUCCESS', method: req.method, path: req.originalUrl, status: 200 });
    sendSuccess(res, { token, user: publicUser(user) }, 'Connexion réussie');
  } catch (err) {
    next(err);
  }
});

// ─── Two-step login (TOTP authenticator app) ───

const mfaLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Trop de tentatives. Réessayez dans quelques minutes.' });
authenticator.options = { window: 1 }; // accepts the previous and next 30-second code (clock drift)
const hashCode = (code: string) => createHash('sha256').update(code.replace(/[^A-Z0-9]/gi, '').toUpperCase()).digest('hex');
const newRecoveryCodes = () => Array.from({ length: 8 }, () => {
  const raw = randomBytes(5).toString('hex').toUpperCase(); // 10 characters
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
});

async function userFromMfaToken(token: string) {
  let payload;
  try { payload = readMfaToken(token); } catch { throw new AppError('Étape expirée : reconnectez-vous avec votre mot de passe.', 401); }
  const user = await prisma.user.findFirst({ where: { id: payload.userId, deletedAt: null, isActive: true } });
  if (!user || (payload.tv ?? 0) !== user.tokenVersion) throw new AppError('Étape expirée : reconnectez-vous avec votre mot de passe.', 401);
  return user;
}

/** First time: a secret to add in Google Authenticator / Microsoft Authenticator (QR code or text). */
router.post('/mfa/setup', mfaLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mfaToken: token } = z.object({ mfaToken: z.string().min(10) }).parse(req.body);
    const user = await userFromMfaToken(token);
    if (user.totpEnabledAt) throw new AppError('La double authentification est déjà activée.', 400);
    const secret = authenticator.generateSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
    const uri = authenticator.keyuri(user.email, 'Cabinet Pro', secret);
    sendSuccess(res, { qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }), secret });
  } catch (err) { next(err); }
});

/** Checks the code (or a recovery code) and opens the session. Confirms the setup the first time. */
router.post('/mfa/verify', mfaLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ mfaToken: z.string().min(10), code: z.string().trim().optional(), recoveryCode: z.string().trim().optional() }).parse(req.body);
    const user = await userFromMfaToken(body.mfaToken);
    if (!user.totpSecret) throw new AppError('Configurez d’abord l’application d’authentification.', 400);
    let recoveryCodes: string[] | undefined;
    let remaining: number | undefined;

    if (body.recoveryCode && user.totpEnabledAt) {
      const hashes: string[] = JSON.parse(user.recoveryCodes || '[]');
      const index = hashes.indexOf(hashCode(body.recoveryCode));
      if (index < 0) throw new AppError('Code de secours invalide ou déjà utilisé.', 400);
      hashes.splice(index, 1);
      await prisma.user.update({ where: { id: user.id }, data: { recoveryCodes: JSON.stringify(hashes) } });
      remaining = hashes.length;
    } else {
      if (!body.code || !authenticator.check(body.code.replace(/\s/g, ''), user.totpSecret)) {
        void writeAuditLog({ userId: user.id, cabinetId: user.cabinetId, action: 'MFA_FAILURE', method: req.method, path: req.originalUrl, status: 400 });
        throw new AppError('Code incorrect. Saisissez le code à 6 chiffres affiché par l’application.', 400);
      }
      if (!user.totpEnabledAt) {
        // Setup confirmed: recovery codes are shown once, only their hashes are kept.
        recoveryCodes = newRecoveryCodes();
        await prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), recoveryCodes: JSON.stringify(recoveryCodes.map(hashCode)) } });
        void writeAuditLog({ userId: user.id, cabinetId: user.cabinetId, action: 'MFA_ENABLED', method: req.method, path: req.originalUrl, status: 200 });
      }
    }

    void writeAuditLog({ userId: user.id, cabinetId: user.cabinetId, action: 'LOGIN_SUCCESS', method: req.method, path: req.originalUrl, status: 200 });
    sendSuccess(res, { token: sessionToken(user), user: publicUser(user), recoveryCodes, remainingRecoveryCodes: remaining }, 'Connexion réussie');
  } catch (err) { next(err); }
});

/** Signs this account out of every device (all existing tokens stop working). */
router.post('/logout-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 } } });
    void writeAuditLog({ userId: req.user!.id, cabinetId: req.user!.cabinetId, action: 'LOGOUT_ALL', method: req.method, path: req.originalUrl, status: 200 });
    sendSuccess(res, null, 'Déconnecté de tous les appareils');
  } catch (err) { next(err); }
});

const RESET_CODE_MINUTES = 15;
const RESET_MAX_ATTEMPTS = 5;
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Trop de demandes. Réessayez dans quelques minutes.' });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: 'Trop de tentatives. Réessayez dans quelques minutes.' });
// Same answer whether the account exists or not, so the form cannot be used to discover emails.
const FORGOT_REPLY = 'Si ce compte existe et a un numéro de téléphone, un code vient d’être envoyé par SMS. Il est valable 15 minutes.';

/** Forgotten password, step 1: send a 6-digit code by SMS to the phone saved on the account. */
router.post('/forgot-password', forgotLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = z.object({ email: z.string().trim().email('Email invalide') }).parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null, isActive: true } });
    if (user?.phone) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await prisma.$transaction([
        // A new code replaces any previous one.
        prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
        prisma.passwordReset.create({ data: { userId: user.id, codeHash: await hashPassword(code), expiresAt: new Date(Date.now() + RESET_CODE_MINUTES * 60_000) } }),
      ]);
      await sendMessage({
        kind: 'PASSWORD_RESET', channel: 'SMS', toPhone: user.phone, cabinetId: user.cabinetId, toUserId: user.id,
        body: `Cabinet Pro : votre code pour changer de mot de passe est ${code}. Il expire dans ${RESET_CODE_MINUTES} minutes. Ne le partagez avec personne.`,
      });
      void writeAuditLog({ userId: user.id, cabinetId: user.cabinetId, action: 'PASSWORD_RESET_REQUESTED', method: req.method, path: req.originalUrl, status: 200 });
    }
    sendSuccess(res, null, FORGOT_REPLY);
  } catch (err) {
    next(err);
  }
});

/** Forgotten password, step 2: check the code and set the new password. */
router.post('/reset-password', resetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      email: z.string().trim().email('Email invalide'),
      code: z.string().trim().regex(/^\d{6}$/, 'Le code contient 6 chiffres'),
      password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
    }).parse(req.body);
    const invalid = new AppError('Code invalide ou expiré. Demandez un nouveau code.', 400);
    const user = await prisma.user.findFirst({ where: { email: data.email.toLowerCase(), deletedAt: null, isActive: true } });
    if (!user) throw invalid;
    const reset = await prisma.passwordReset.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!reset || reset.attempts >= RESET_MAX_ATTEMPTS) throw invalid;
    if (!(await comparePassword(data.code, reset.codeHash))) {
      await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(data.password), tokenVersion: { increment: 1 } } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    ]);
    void writeAuditLog({ userId: user.id, cabinetId: user.cabinetId, action: 'PASSWORD_RESET', method: req.method, path: req.originalUrl, status: 200 });
    sendSuccess(res, null, 'Mot de passe modifié. Vous pouvez vous connecter.');
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        cabinet: { select: { id: true, name: true, specialty: true, plan: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true, isActive: true, isDemo: true, currency: true } },
      },
    });
    if (!user) throw new AppError('Utilisateur non trouvé', 404);

    sendSuccess(res, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      title: user.title,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      specialty: user.specialty,
      seesAllPatients: user.role === 'OWNER' || user.seesAllPatients,
      cabinetId: user.cabinetId,
      cabinet: user.cabinet,
      permissions: req.user!.permissions || [],
      blocked: req.user!.blocked || null,
      mfa: {
        enabled: !!user.totpEnabledAt,
        required: mfaRequiredFor(user),
        recoveryCodesLeft: user.recoveryCodes ? (JSON.parse(user.recoveryCodes) as string[]).length : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Own password change: needs the current one, signs every other device out, keeps this one with a fresh token. */
router.post('/change-password', authenticate, mfaLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
      password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
    }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await comparePassword(data.currentPassword, user.password))) throw new AppError('Mot de passe actuel incorrect', 400);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(data.password), tokenVersion: { increment: 1 } },
    });
    sendSuccess(res, { token: sessionToken(updated) }, 'Mot de passe modifié. Les autres appareils sont déconnectés.');
  } catch (err) { next(err); }
});

export default router;
