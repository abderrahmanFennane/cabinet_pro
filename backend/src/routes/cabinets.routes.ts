import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/auth';
import { sendSuccess } from '../utils/response';
import { authenticate, requirePermissions, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { copyDefaultActs, planQuotas } from '../services/cabinet-setup';
import { SPECIALTIES } from '../types/permissions';
import { resetDemoCabinet } from '../services/demo';
import { writeAuditLog } from '../utils/audit';

// Cabinet records: the Super Admin manages every cabinet (F-SA-01); the owner reads and edits their own settings.
const router = Router();
router.use(authenticate);

const DAY = 24 * 60 * 60 * 1000;
const counts = { _count: { select: { users: true, patients: true } } };
const superAdmin = [requireRoles('SUPER_ADMIN'), requirePermissions('MANAGE_CABINETS')];

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nom du cabinet requis'),
  specialty: z.enum(SPECIALTIES).default('DENTISTRY'),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().nullable(),
  currency: z.string().default('MAD'),
  plan: z.string().min(1).default('TRIAL'),
  owner: z.object({
    email: z.string().email('Email du titulaire invalide'),
    password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
    firstName: z.string().min(1, 'Prénom requis'),
    lastName: z.string().min(1, 'Nom requis'),
    phone: z.string().optional(),
  }).optional(),
});

const settingsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Email invalide').nullable().optional().or(z.literal('').transform(() => null)),
  logo: z.string().nullable().optional(),
  letterhead: z.string().max(2000).nullable().optional(),
  currency: z.string().optional(),
  remindersEnabled: z.boolean().optional(),
  reminderChannel: z.enum(['WHATSAPP', 'SMS', 'BOTH']).optional(),
  reminderLeadMinutes: z.array(z.number().int().min(15).max(7 * 24 * 60)).max(3).optional(),
});

const subscriptionSchema = z.object({
  plan: z.string().min(1),
  subscriptionStatus: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED']).optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
  // Manual payment (cash, bank transfer...) recorded as a paid invoice.
  payment: z.object({ amount: z.number().min(0), method: z.string().min(1).default('CASH'), reference: z.string().optional().nullable() }).optional().nullable(),
});

const serialize = (cabinet: any) => ({
  id: cabinet.id,
  name: cabinet.name,
  address: cabinet.address,
  city: cabinet.city,
  phone: cabinet.phone,
  email: cabinet.email,
  logo: cabinet.logo,
  letterhead: cabinet.letterhead,
  currency: cabinet.currency,
  specialty: cabinet.specialty,
  isDemo: cabinet.isDemo,
  isActive: cabinet.isActive,
  plan: cabinet.plan,
  subscriptionStatus: cabinet.subscriptionStatus,
  trialEndsAt: cabinet.trialEndsAt,
  currentPeriodEnd: cabinet.currentPeriodEnd,
  maxPractitioners: cabinet.maxPractitioners,
  maxAssistants: cabinet.maxAssistants,
  monthlyMessages: cabinet.monthlyMessages,
  remindersEnabled: cabinet.remindersEnabled,
  reminderChannel: cabinet.reminderChannel,
  reminderLeadMinutes: String(cabinet.reminderLeadMinutes || '').split(',').filter(Boolean).map(Number),
  createdAt: cabinet.createdAt,
  updatedAt: cabinet.updatedAt,
  _count: cabinet._count,
});

const assertOwnCabinet = (req: Request, id: string) => {
  if (req.user!.role !== 'SUPER_ADMIN' && req.user!.cabinetId !== id) throw new AppError('Accès non autorisé', 403);
};

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role === 'SUPER_ADMIN') {
      await prisma.cabinet.updateMany({ where: { isActive: true, isDemo: false, currentPeriodEnd: { lt: new Date() } }, data: { isActive: false, subscriptionStatus: 'PAST_DUE' } });
    }
    const where = req.user!.role === 'SUPER_ADMIN' ? { deletedAt: null } : { deletedAt: null, id: req.user!.cabinetId! };
    const cabinets = await prisma.cabinet.findMany({ where, include: counts, orderBy: [{ isDemo: 'desc' }, { createdAt: 'desc' }] });
    const now = new Date();
    const grants = req.user!.role === 'SUPER_ADMIN'
      ? await prisma.supportAccessGrant.findMany({ where: { revokedAt: null, expiresAt: { gt: now } }, select: { cabinetId: true, expiresAt: true, readOnly: true } })
      : [];
    const grantByCabinet = new Map(grants.map(g => [g.cabinetId, g]));
    sendSuccess(res, cabinets.map(c => ({ ...serialize(c), supportAccess: grantByCabinet.get(c.id) || null })));
  } catch (err) { next(err); }
});

router.post('/', ...superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSchema.parse(req.body);
    const cabinet = await prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({ where: { code: data.plan } });
      if (!plan || !plan.isActive) throw new AppError('Plan invalide ou inactif', 400);
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);
      const created = await tx.cabinet.create({
        data: {
          name: data.name, specialty: data.specialty, address: data.address, city: data.city, phone: data.phone, email: data.email, currency: data.currency,
          plan: plan.code, subscriptionStatus: 'ACTIVE', currentPeriodEnd: periodEnd, ...planQuotas(plan),
        },
        include: counts,
      });
      await tx.subscriptionHistory.create({ data: { cabinetId: created.id, plan: plan.code, status: 'ACTIVE', startedAt: new Date(), periodEnd } });
      await copyDefaultActs(tx, created.id, data.specialty);
      if (data.owner) {
        const email = data.owner.email.toLowerCase();
        if (await tx.user.findUnique({ where: { email } })) throw new AppError('Cet email est déjà utilisé', 409);
        await tx.user.create({
          data: {
            email, password: await hashPassword(data.owner.password), firstName: data.owner.firstName, lastName: data.owner.lastName,
            phone: data.owner.phone, title: 'Dr', role: 'OWNER', specialty: data.specialty, seesAllPatients: true, cabinetId: created.id,
          },
        });
      }
      return created;
    });
    sendSuccess(res, serialize(cabinet), 'Cabinet créé', undefined, 201);
  } catch (err) { next(err); }
});

/** Rebuilds the demo cabinet with fresh fictitious data dated today (F-SA-03). */
router.post('/demo/reset', ...superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinet = await resetDemoCabinet();
    void writeAuditLog({ userId: req.user!.id, cabinetId: cabinet.id, action: 'DEMO_RESET', method: req.method, path: req.originalUrl, status: 200 });
    sendSuccess(res, { id: cabinet.id }, 'Cabinet de démonstration remis à zéro');
  } catch (err) { next(err); }
});

router.get('/subscription-alerts', ...superAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const warningEnd = new Date(now.getTime() + 7 * DAY);
    const cabinets = await prisma.cabinet.findMany({ where: { deletedAt: null, isDemo: false, currentPeriodEnd: { lte: warningEnd } }, include: counts, orderBy: { currentPeriodEnd: 'asc' } });
    const failures = await prisma.billingInvoice.findMany({ where: { status: 'FAILED', cabinetId: { in: cabinets.map(c => c.id) } }, distinct: ['cabinetId'] });
    const failed = new Set(failures.map(f => f.cabinetId));
    const alerts = cabinets.flatMap(cabinet => {
      const result: any[] = [];
      if (cabinet.currentPeriodEnd && cabinet.currentPeriodEnd <= now) result.push({ ...serialize(cabinet), alert: 'EXPIRED' });
      else if (cabinet.currentPeriodEnd) result.push({ ...serialize(cabinet), alert: 'EXPIRING_SOON' });
      if (failed.has(cabinet.id)) result.push({ ...serialize(cabinet), alert: 'PAYMENT_FAILED' });
      return result;
    });
    sendSuccess(res, alerts);
  } catch (err) { next(err); }
});

/** SaaS figures for the Super Admin: subscriptions, recurring revenue, collections, renewals, and cabinets per specialty. */
router.get('/saas-metrics', ...superAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * DAY);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [cabinets, plans, paidInvoices, trialHistory] = await Promise.all([
      prisma.cabinet.findMany({ where: { deletedAt: null, isDemo: false }, select: { id: true, name: true, phone: true, email: true, plan: true, specialty: true, isActive: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true, createdAt: true } }),
      prisma.plan.findMany({ where: { deletedAt: null } }),
      prisma.billingInvoice.findMany({ where: { status: 'PAID', paidAt: { gte: sixMonthsAgo } }, select: { amount: true, paidAt: true } }),
      prisma.subscriptionHistory.findMany({ where: { status: 'TRIALING' }, select: { cabinetId: true }, distinct: ['cabinetId'] }),
    ]);

    const planByCode = new Map(plans.map(plan => [plan.code, plan]));
    const live = (c: typeof cabinets[number]) => c.isActive && (!c.currentPeriodEnd || c.currentPeriodEnd > now);
    const trialing = cabinets.filter(c => c.subscriptionStatus === 'TRIALING' && live(c));
    const paying = cabinets.filter(c => c.subscriptionStatus === 'ACTIVE' && live(c));
    const expired = cabinets.filter(c => c.currentPeriodEnd && c.currentPeriodEnd <= now);
    const suspended = cabinets.filter(c => !c.isActive && !(c.currentPeriodEnd && c.currentPeriodEnd <= now));
    const monthlyValue = (code: string) => {
      const plan = planByCode.get(code);
      return plan ? Number(plan.monthlyPrice) / Math.max(1, plan.durationMonths) : 0;
    };
    const mrr = paying.reduce((sum, c) => sum + monthlyValue(c.plan), 0);
    const byPlan = [...new Set(paying.map(c => c.plan))].map(code => {
      const list = paying.filter(c => c.plan === code);
      return { plan: code, name: planByCode.get(code)?.name || code, cabinets: list.length, mrr: list.length * monthlyValue(code) };
    }).sort((a, b) => b.mrr - a.mrr);
    const bySpecialty = [...new Set(cabinets.map(c => c.specialty))].map(specialty => {
      const list = cabinets.filter(c => c.specialty === specialty);
      return { specialty, cabinets: list.length, paying: list.filter(c => paying.includes(c)).length, mrr: list.filter(c => paying.includes(c)).reduce((s, c) => s + monthlyValue(c.plan), 0) };
    });
    const months = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { month: start.toISOString().slice(0, 7), total: paidInvoices.filter(i => i.paidAt && i.paidAt >= start && i.paidAt < end).reduce((s, i) => s + Number(i.amount), 0) };
    });
    const trialIds = new Set(trialHistory.map(entry => entry.cabinetId));
    const converted = cabinets.filter(c => trialIds.has(c.id) && c.subscriptionStatus === 'ACTIVE').length;
    const pick = (c: typeof cabinets[number]) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, plan: c.plan, subscriptionStatus: c.subscriptionStatus, currentPeriodEnd: c.currentPeriodEnd });
    const byEnd = (a: typeof cabinets[number], b: typeof cabinets[number]) => +a.currentPeriodEnd! - +b.currentPeriodEnd!;

    sendSuccess(res, {
      counts: { total: cabinets.length, trialing: trialing.length, paying: paying.length, expired: expired.length, suspended: suspended.length, newThisMonth: cabinets.filter(c => c.createdAt >= monthStart).length },
      mrr,
      collectedThisMonth: months[months.length - 1].total,
      revenueByMonth: months,
      byPlan,
      bySpecialty,
      trialConversion: { trials: trialIds.size, converted, rate: trialIds.size ? converted / trialIds.size : 0 },
      trialsEndingSoon: trialing.filter(c => c.currentPeriodEnd && c.currentPeriodEnd <= in7Days).sort(byEnd).map(pick),
      renewalsDueSoon: paying.filter(c => c.currentPeriodEnd && c.currentPeriodEnd <= in7Days).sort(byEnd).map(pick),
      recentlyExpired: expired.filter(c => c.currentPeriodEnd! >= new Date(now.getTime() - 14 * DAY)).sort((a, b) => byEnd(b, a)).map(pick),
    });
  } catch (err) { next(err); }
});

router.get('/:id/subscription-history', ...superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.subscriptionHistory.findMany({ where: { cabinetId: req.params.id }, orderBy: { createdAt: 'desc' } }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertOwnCabinet(req, req.params.id);
    const cabinet = await prisma.cabinet.findFirst({ where: { id: req.params.id, deletedAt: null }, include: counts });
    if (!cabinet) throw new AppError('Cabinet non trouvé', 404);
    sendSuccess(res, serialize(cabinet));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertOwnCabinet(req, req.params.id);
    if (req.user!.role !== 'SUPER_ADMIN' && !req.user!.permissions?.includes('MANAGE_SETTINGS')) throw new AppError('Permission refusée', 403);
    const { reminderLeadMinutes, ...data } = settingsSchema.parse(req.body);
    const extra = req.user!.role === 'SUPER_ADMIN' ? z.object({ specialty: z.enum(SPECIALTIES).optional() }).parse(req.body) : {};
    const cabinet = await prisma.cabinet.update({
      where: { id: req.params.id },
      data: { ...data, ...extra, reminderLeadMinutes: reminderLeadMinutes ? [...new Set(reminderLeadMinutes)].sort((a, b) => b - a).join(',') : undefined },
      include: counts,
    });
    sendSuccess(res, serialize(cabinet), 'Cabinet mis à jour');
  } catch (err) { next(err); }
});

router.patch('/:id/status', ...superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const cabinet = await prisma.cabinet.update({ where: { id: req.params.id }, data: { isActive, subscriptionStatus: isActive ? undefined : 'SUSPENDED' }, include: counts });
    sendSuccess(res, serialize(cabinet), isActive ? 'Cabinet activé' : 'Cabinet suspendu');
  } catch (err) { next(err); }
});

router.patch('/:id/subscription', ...superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = subscriptionSchema.parse(req.body);
    const plan = await prisma.plan.findUnique({ where: { code: data.plan } });
    if (!plan || !plan.isActive) throw new AppError('Plan invalide ou inactif', 400);
    const status = data.subscriptionStatus || 'ACTIVE';
    // An explicit end date wins; otherwise a new full period of the plan starts today.
    let periodEnd = new Date();
    if (data.currentPeriodEnd) periodEnd = new Date(data.currentPeriodEnd);
    else periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);
    const cabinet = await prisma.cabinet.update({
      where: { id: req.params.id },
      data: {
        plan: plan.code,
        isActive: !['SUSPENDED', 'CANCELLED'].includes(status) && periodEnd > new Date(),
        subscriptionStatus: status,
        currentPeriodEnd: periodEnd,
        ...planQuotas(plan),
        trialEndsAt: data.trialEndsAt === undefined ? undefined : data.trialEndsAt ? new Date(data.trialEndsAt) : null,
      },
      include: counts,
    });
    await prisma.subscriptionHistory.create({ data: { cabinetId: cabinet.id, plan: plan.code, status, startedAt: new Date(), periodEnd } });
    if (data.payment && data.payment.amount > 0) {
      await prisma.billingInvoice.create({
        data: {
          cabinetId: cabinet.id, plan: plan.code, amount: data.payment.amount, currency: cabinet.currency || 'MAD', status: 'PAID', paidAt: new Date(),
          periodEnd, paymentMethod: data.payment.method, reference: data.payment.reference || null,
        },
      });
    }
    sendSuccess(res, serialize(cabinet), 'Abonnement mis à jour');
  } catch (err) { next(err); }
});

router.delete('/:id', ...superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinet = await prisma.cabinet.findUnique({ where: { id: req.params.id } });
    if (!cabinet) throw new AppError('Cabinet non trouvé', 404);
    if (cabinet.isDemo) throw new AppError('Le cabinet de démonstration ne peut pas être supprimé', 400);
    await prisma.cabinet.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } });
    sendSuccess(res, null, 'Cabinet supprimé');
  } catch (err) { next(err); }
});

export default router;
