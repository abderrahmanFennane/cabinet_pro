import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { dayRange, localDay } from '../utils/local-day';
import { toNumber } from '../utils/patient-scope';
import { providerStatus } from '../services/messaging';

/**
 * Super Admin home: the platform's day and the clinics to look after.
 * Counts only: no patient name nor medical content leaves the clinics.
 */
const router = Router();
router.use(authenticate, requireRoles('SUPER_ADMIN'));

const DAY = 86_400_000;

router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const { start, end } = dayRange(localDay(now));
    const monthStart = dayRange(`${localDay(now).slice(0, 8)}01`).start;
    const real = { isDemo: false, deletedAt: null };

    const [cabinets, plans, loginsToday, activeUsersToday, appointmentsToday, consultationsToday, newPatientsToday, messagesToday, failedMessages, paidMonth, pendingInvoices, newCabinetsMonth] = await Promise.all([
      prisma.cabinet.findMany({
        where: real,
        select: { id: true, name: true, city: true, plan: true, subscriptionStatus: true, isActive: true, trialEndsAt: true, currentPeriodEnd: true, createdAt: true, phone: true, specialty: true },
      }),
      prisma.plan.findMany({ select: { code: true, name: true, monthlyPrice: true } }),
      prisma.auditLog.count({ where: { action: 'LOGIN_SUCCESS', createdAt: { gte: start, lt: end } } }),
      prisma.auditLog.findMany({ where: { action: 'LOGIN_SUCCESS', createdAt: { gte: start, lt: end }, userId: { not: null } }, distinct: ['userId'], select: { userId: true } }),
      prisma.appointment.count({ where: { date: { gte: start, lt: end }, deletedAt: null, cabinet: real } }),
      prisma.consultation.count({ where: { date: { gte: start, lt: end }, cabinet: real } }),
      prisma.patient.count({ where: { createdAt: { gte: start, lt: end }, cabinet: real } }),
      prisma.message.groupBy({ by: ['channel', 'status'], where: { createdAt: { gte: start, lt: end }, channel: { in: ['SMS', 'WHATSAPP'] } }, _count: true }),
      prisma.message.findMany({
        where: { createdAt: { gte: new Date(now.getTime() - 2 * DAY) }, status: 'FAILED', channel: { in: ['SMS', 'WHATSAPP'] } },
        select: { id: true, channel: true, kind: true, error: true, createdAt: true, cabinetId: true }, orderBy: { createdAt: 'desc' }, take: 10,
      }),
      prisma.billingInvoice.findMany({ where: { status: 'PAID', paidAt: { gte: monthStart } }, select: { amount: true } }),
      prisma.billingInvoice.count({ where: { status: 'PENDING' } }),
      prisma.cabinet.count({ where: { ...real, createdAt: { gte: monthStart } } }),
    ]);

    const price = new Map(plans.map(p => [p.code, toNumber(p.monthlyPrice)]));
    const paying = cabinets.filter(c => c.isActive && c.subscriptionStatus === 'ACTIVE');
    const soon = (d: Date | null, days: number) => !!d && d.getTime() > now.getTime() && d.getTime() - now.getTime() <= days * DAY;
    const brief = (c: typeof cabinets[number], date: Date | null) => ({ id: c.id, name: c.name, city: c.city, phone: c.phone, plan: c.plan, date });

    sendSuccess(res, {
      day: localDay(now),
      today: {
        logins: loginsToday,
        activeUsers: activeUsersToday.length,
        appointments: appointmentsToday,
        consultations: consultationsToday,
        newPatients: newPatientsToday,
        messages: messagesToday.reduce((s, m) => s + m._count, 0),
        messagesFailed: messagesToday.filter(m => m.status === 'FAILED').reduce((s, m) => s + m._count, 0),
      },
      cabinets: {
        total: cabinets.length,
        active: paying.length,
        trialing: cabinets.filter(c => c.isActive && c.subscriptionStatus === 'TRIALING').length,
        blocked: cabinets.filter(c => !c.isActive).length,
        newThisMonth: newCabinetsMonth,
        byPlan: plans.map(p => ({ code: p.code, name: p.name, count: paying.filter(c => c.plan === p.code).length })).filter(p => p.count),
      },
      revenue: {
        monthlyRecurring: paying.reduce((s, c) => s + (price.get(c.plan) || 0), 0),
        paidThisMonth: paidMonth.reduce((s, i) => s + toNumber(i.amount), 0),
        pendingInvoices,
      },
      watch: {
        trialsEnding: cabinets.filter(c => c.subscriptionStatus === 'TRIALING' && soon(c.trialEndsAt, 7)).map(c => brief(c, c.trialEndsAt)),
        renewalsDue: cabinets.filter(c => c.subscriptionStatus === 'ACTIVE' && soon(c.currentPeriodEnd, 15)).map(c => brief(c, c.currentPeriodEnd)),
        blocked: cabinets.filter(c => !c.isActive).slice(0, 10).map(c => brief(c, c.currentPeriodEnd)),
      },
      messaging: { providers: providerStatus(), failed: failedMessages.map(m => ({ id: m.id, channel: m.channel, kind: m.kind, error: m.error, createdAt: m.createdAt, cabinet: cabinets.find(c => c.id === m.cabinetId)?.name ?? null })) },
    });
  } catch (err) { next(err); }
});

export default router;
