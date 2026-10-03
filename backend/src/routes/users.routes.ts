import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/auth';
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
  isActive: user.isActive, createdAt: user.createdAt, cabinet: user.cabinet || null,
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
    const user = await prisma.user.update({ where: { id: existing.id }, data: update, include: userInclude });
    sendSuccess(res, serialize(user), 'Utilisateur mis à jour');
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
    await prisma.user.update({ where: { id: existing.id }, data: { deletedAt: new Date(), isActive: false, email: `${existing.email}#deleted-${Date.now()}` } });
    sendSuccess(res, null, 'Utilisateur supprimé');
  } catch (err) { next(err); }
});

router.get('/admins', requireRoles('SUPER_ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, (await prisma.user.findMany({ where: { role: 'SUPER_ADMIN', deletedAt: null }, include: userInclude })).map(serialize));
  } catch (err) { next(err); }
});

export default router;
