import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { sendSuccess } from '../utils/response';
import { rateLimit } from '../utils/rate-limit';
import { SPECIALTIES } from '../types/permissions';

const STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED'] as const;

// ─── Public: the trial request form of the home page (no account) ───

export const publicTrialRequests = Router();
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Trop de demandes depuis cette connexion. Réessayez plus tard ou appelez-nous.' });

const THANKS = 'Merci ! Votre demande est bien reçue : nous vous contactons très vite pour ouvrir votre essai.';

publicTrialRequests.post('/', limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Honeypot: a hidden field people never fill. Robots get the usual answer and nothing is saved.
    if (req.body?.website) { sendSuccess(res, null, THANKS, undefined, 201); return; }
    const data = z.object({
      fullName: z.string().trim().min(3, 'Indiquez votre nom complet').max(120),
      email: z.string().trim().toLowerCase().email('Email non valide').max(160),
      phone: z.string().trim().min(8, 'Téléphone non valide').max(30).regex(/^[+0-9 ().-]+$/, 'Téléphone non valide'),
      cabinetName: z.string().trim().max(160).nullable().optional(),
      city: z.string().trim().max(80).nullable().optional(),
      specialty: z.enum(SPECIALTIES).nullable().optional(),
      doctors: z.coerce.number().int().min(1).max(200).nullable().optional(),
      message: z.string().trim().max(2000).nullable().optional(),
      consent: z.literal(true, { errorMap: () => ({ message: 'Acceptez d’être contacté pour envoyer la demande' }) }),
      website: z.string().optional(),
    }).parse(req.body);
    const { consent: _consent, website: _website, ...fields } = data;
    // Cap on new requests per day for the whole site: a botnet staying under the per-IP limit cannot flood the database.
    const today = await prisma.trialRequest.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (today >= (Number(process.env.TRIAL_REQUESTS_PER_DAY) || 300)) throw new AppError('Le formulaire est momentanément indisponible. Appelez-nous ou réessayez demain.', 429);
    // The same person sending the form again the same day updates their request instead of creating a duplicate.
    const recent = await prisma.trialRequest.findFirst({ where: { email: fields.email, status: 'NEW', createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (recent) await prisma.trialRequest.update({ where: { id: recent.id }, data: fields });
    else await prisma.trialRequest.create({ data: { ...fields, ip: req.ip || null } });
    sendSuccess(res, null, THANKS, undefined, 201);
  } catch (err) { next(err); }
});

// ─── Super Admin: "Demandes d'essai" ───

const router = Router();
router.use(authenticate, requireRoles('SUPER_ADMIN'));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ status: z.enum(STATUSES).optional() }).parse(req.query);
    const [items, counts] = await Promise.all([
      prisma.trialRequest.findMany({ where: q.status ? { status: q.status } : {}, orderBy: { createdAt: 'desc' }, take: 500 }),
      prisma.trialRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    sendSuccess(res, { items, counts: Object.fromEntries(STATUSES.map(s => [s, counts.find(c => c.status === s)?._count._all ?? 0])) });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ status: z.enum(STATUSES).optional(), notes: z.string().max(4000).nullable().optional(), cabinetId: z.string().nullable().optional() }).parse(req.body);
    const existing = await prisma.trialRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Demande introuvable', 404);
    sendSuccess(res, await prisma.trialRequest.update({ where: { id: existing.id }, data: { ...data, handledById: req.user!.id } }), 'Demande mise à jour');
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.trialRequest.deleteMany({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Demande supprimée');
  } catch (err) { next(err); }
});

export default router;
