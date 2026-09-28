import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { toNumber } from '../../utils/patient-scope';
import { COMMON_DRUGS } from '../../data/drugs';

// Cabinet-level routes mounted at /api/cabinets/:cabinetId: team, dashboard, access log, support access,
// prescription templates and drug search.
const router = Router({ mergeParams: true });

const DAY = 86_400_000;
const startOfDay = (date = new Date()) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };

router.get('/team', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { cabinetId: req.params.cabinetId, deletedAt: null, isActive: true },
      select: { id: true, firstName: true, lastName: true, title: true, role: true, specialty: true },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
    sendSuccess(res, users);
  } catch (err) { next(err); }
});

/** Section 5.7: day figures, revenue, unpaid, no-show rate, top acts, new patients, plus dental indicators. */
router.get('/dashboard', requirePermissions('VIEW_REPORTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinetId = req.params.cabinetId;
    const own = req.user!.role === 'PRACTITIONER';
    const me = req.user!.id;
    const today = startOfDay();
    const tomorrow = new Date(today.getTime() + DAY);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const since30 = new Date(today.getTime() - 30 * DAY);
    const apptScope = { cabinetId, deletedAt: null, ...(own ? { practitionerId: me } : {}) };
    const invoiceScope = { cabinetId, status: { not: 'CANCELLED' }, ...(own ? { practitionerId: me } : {}) };

    const [todayAppointments, seenToday, paymentsToday, paymentsMonth, unpaid, last30, newPatients, topActs, plansInProgress, quotesOpen] = await Promise.all([
      prisma.appointment.count({ where: { ...apptScope, date: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } } }),
      prisma.appointment.count({ where: { ...apptScope, date: { gte: today, lt: tomorrow }, status: 'DONE' } }),
      prisma.payment.aggregate({ where: { cabinetId, paidAt: { gte: today, lt: tomorrow }, ...(own ? { invoice: { practitionerId: me } } : {}) }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { cabinetId, paidAt: { gte: monthStart }, ...(own ? { invoice: { practitionerId: me } } : {}) }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { ...invoiceScope, status: { in: ['OPEN', 'PARTIAL'] } }, _sum: { total: true, paid: true }, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['status'], where: { ...apptScope, date: { gte: since30, lt: tomorrow } }, _count: { _all: true } }),
      prisma.patient.count({ where: { cabinetId, deletedAt: null, createdAt: { gte: monthStart } } }),
      prisma.invoiceItem.groupBy({ by: ['label'], where: { invoice: { ...invoiceScope, date: { gte: since30 } } }, _count: { _all: true }, _sum: { total: true }, orderBy: { _count: { label: 'desc' } }, take: 6 }),
      prisma.treatmentPlan.count({ where: { cabinetId, status: { in: ['ACCEPTED', 'IN_PROGRESS'] }, ...(own ? { practitionerId: me } : {}) } }),
      prisma.quote.count({ where: { cabinetId, status: { in: ['DRAFT', 'SENT'] } } }),
    ]);

    const counted = last30.reduce((s, g) => s + g._count._all, 0);
    const noShows = last30.find(g => g.status === 'NO_SHOW')?._count._all || 0;

    let revenueByMonth: { month: string; total: number }[] | null = null;
    if (req.user!.permissions?.includes('ADVANCED_STATS')) {
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const payments = await prisma.payment.findMany({ where: { cabinetId, paidAt: { gte: sixMonthsAgo }, ...(own ? { invoice: { practitionerId: me } } : {}) }, select: { amount: true, paidAt: true } });
      revenueByMonth = Array.from({ length: 6 }, (_, i) => {
        const start = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        return { month: start.toISOString().slice(0, 7), total: payments.filter(p => p.paidAt >= start && p.paidAt < end).reduce((s, p) => s + toNumber(p.amount), 0) };
      });
    }

    sendSuccess(res, {
      todayAppointments,
      seenToday,
      revenueToday: toNumber(paymentsToday._sum.amount),
      revenueMonth: toNumber(paymentsMonth._sum.amount),
      unpaid: { amount: toNumber(unpaid._sum.total) - toNumber(unpaid._sum.paid), invoices: unpaid._count._all },
      noShowRate: counted ? noShows / counted : 0,
      newPatients,
      topActs: topActs.map(a => ({ label: a.label, count: a._count._all, total: toNumber(a._sum.total) })),
      dental: { plansInProgress, quotesOpen },
      revenueByMonth,
    });
  } catch (err) { next(err); }
});

/**
 * Who opened which patient record (owner only).
 * Platform (Super Admin) activity is only shown in the Super Admin's own audit log, never to cabinet users.
 */
router.get('/access-log', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ patientId: z.string().optional(), action: z.string().optional(), take: z.coerce.number().int().min(1).max(500).default(200) }).parse(req.query);
    const hidePlatform = req.user!.role !== 'SUPER_ADMIN';
    const platformIds = hidePlatform ? (await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })).map(u => u.id) : [];
    const logs = await prisma.patientAccessLog.findMany({
      where: {
        cabinetId: req.params.cabinetId,
        ...(q.patientId ? { patientId: q.patientId } : {}),
        AND: [
          q.action ? { action: q.action } : {},
          hidePlatform ? { userId: { notIn: platformIds }, action: { not: 'SUPPORT_VIEW' } } : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: q.take,
    });
    const [users, patients] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: [...new Set(logs.map(l => l.userId))] } }, select: { id: true, firstName: true, lastName: true, role: true } }),
      prisma.patient.findMany({ where: { id: { in: [...new Set(logs.map(l => l.patientId))] } }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const userById = new Map(users.map(u => [u.id, u]));
    const patientById = new Map(patients.map(p => [p.id, p]));
    sendSuccess(res, logs.map(log => ({ ...log, user: userById.get(log.userId) || null, patient: patientById.get(log.patientId) || null })));
  } catch (err) { next(err); }
});

// ─── Support access granted by the owner (F-SA-04) ───

router.get('/support-grants', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.supportAccessGrant.findMany({ where: { cabinetId: req.params.cabinetId }, orderBy: { createdAt: 'desc' }, take: 20 }));
  } catch (err) { next(err); }
});

router.post('/support-grants', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'OWNER') throw new AppError('Seul le médecin titulaire peut autoriser un accès support', 403);
    const data = z.object({ hours: z.number().int().min(1).max(72).default(24), readOnly: z.boolean().default(true), reason: z.string().max(190).optional() }).parse(req.body);
    await prisma.supportAccessGrant.updateMany({ where: { cabinetId: req.params.cabinetId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
    const grant = await prisma.supportAccessGrant.create({
      data: { cabinetId: req.params.cabinetId, grantedById: req.user!.id, readOnly: data.readOnly, reason: data.reason, expiresAt: new Date(Date.now() + data.hours * 3600_000) },
    });
    sendSuccess(res, grant, 'Accès support autorisé', undefined, 201);
  } catch (err) { next(err); }
});

router.delete('/support-grants/:id', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.supportAccessGrant.updateMany({ where: { id: req.params.id, cabinetId: req.params.cabinetId, revokedAt: null }, data: { revokedAt: new Date() } });
    sendSuccess(res, null, 'Accès support révoqué');
  } catch (err) { next(err); }
});

// ─── Prescription templates and drug search ───

router.get('/prescription-templates', requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.prescriptionTemplate.findMany({
      where: { cabinetId: req.params.cabinetId, OR: [{ practitionerId: null }, { practitionerId: req.user!.id }] },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, templates.map(t => ({ ...t, items: JSON.parse(t.items) })));
  } catch (err) { next(err); }
});

router.post('/prescription-templates', requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      name: z.string().trim().min(1),
      shared: z.boolean().default(false),
      items: z.array(z.object({ drug: z.string().min(1), dosage: z.string().nullable().optional(), duration: z.string().nullable().optional(), notes: z.string().nullable().optional() })).min(1),
    }).parse(req.body);
    const template = await prisma.prescriptionTemplate.create({
      data: { cabinetId: req.params.cabinetId, practitionerId: data.shared ? null : req.user!.id, name: data.name, items: JSON.stringify(data.items) },
    });
    sendSuccess(res, { ...template, items: data.items }, 'Modèle enregistré', undefined, 201);
  } catch (err) { next(err); }
});

router.delete('/prescription-templates/:id', requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.prescriptionTemplate.deleteMany({ where: { id: req.params.id, cabinetId: req.params.cabinetId } });
    sendSuccess(res, null, 'Modèle supprimé');
  } catch (err) { next(err); }
});

router.get('/drugs', requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const recent = await prisma.prescription.findMany({ where: { cabinetId: req.params.cabinetId }, select: { items: true }, orderBy: { date: 'desc' }, take: 200 });
    const used = new Set<string>();
    for (const p of recent) {
      try { for (const item of JSON.parse(p.items)) if (item?.drug) used.add(item.drug); } catch { /* ignore malformed rows */ }
    }
    const names = [...new Set([...used, ...COMMON_DRUGS.map(d => d.name)])];
    sendSuccess(res, names.filter(name => !search || name.toLowerCase().includes(search)).slice(0, 20));
  } catch (err) { next(err); }
});

export default router;
