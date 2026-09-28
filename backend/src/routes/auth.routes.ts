import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { comparePassword, generateToken, hashPassword } from '../utils/auth';
import { rateLimit } from '../utils/rate-limit';
import { createInboxMessage } from '../services/messaging';
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

    const token = generateToken({ userId: user.id, role: user.role, cabinetId: cabinet.id });
    sendSuccess(res, { token, user: publicUser(user) }, 'Essai gratuit activé', undefined, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });

    if (!user || !(await comparePassword(password, user.password))) {
      void writeAuditLog({ action: 'LOGIN_FAILURE', method: req.method, path: req.originalUrl, status: 401 });
      throw new AppError('Identifiants invalides', 401);
    }
    if (!user.isActive) {
      throw new AppError('Votre compte est désactivé. Contactez le médecin titulaire.', 403);
    }
    // Blocked cabinets (trial ended, plan expired, suspended) can still sign in:
    // the app then shows the renewal / contact page instead of the workspace.

    const token = generateToken({ userId: user.id, role: user.role, cabinetId: user.cabinetId });
    void writeAuditLog({ userId: user.id, cabinetId: user.cabinetId, action: 'LOGIN_SUCCESS', method: req.method, path: req.originalUrl, status: 200 });
    sendSuccess(res, { token, user: publicUser(user) }, 'Connexion réussie');
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
    });
  } catch (err) {
    next(err);
  }
});

export default router;
