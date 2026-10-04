import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { authenticate, requirePermissions, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { sendSuccess } from '../utils/response';
import { writeAuditLog } from '../utils/audit';
import { planQuotas } from '../services/cabinet-setup';
import { cmiConfig, cmiConfigured, cmiForm, verifyCmiHash } from '../services/cmi';

const router = Router();
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

const getAdminCabinet = async (req: Request) => {
  if (!req.user?.cabinetId) throw new AppError('Cabinet non trouvé', 404);
  const cabinet = await prisma.cabinet.findUnique({ where: { id: req.user.cabinetId, deletedAt: null } });
  if (!cabinet) throw new AppError('Cabinet non trouvé', 404);
  return cabinet;
};

router.get('/subscription', authenticate, requireRoles('OWNER'), requirePermissions('MANAGE_SUBSCRIPTION'), async (req, res, next) => {
  try {
    const cabinet = await getAdminCabinet(req);
    const plan = await prisma.plan.findUnique({ where: { code: cabinet.plan } });
    sendSuccess(res, { cabinet, plan });
  } catch (err) { next(err); }
});

router.get('/plans', authenticate, requireRoles('OWNER'), requirePermissions('MANAGE_SUBSCRIPTION'), async (_req, res, next) => {
  try {
    sendSuccess(res, await prisma.plan.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { monthlyPrice: 'asc' } }));
  } catch (err) { next(err); }
});

router.get('/invoices', authenticate, requireRoles('OWNER'), requirePermissions('MANAGE_SUBSCRIPTION'), async (req, res, next) => {
  try {
    const cabinet = await getAdminCabinet(req);
    sendSuccess(res, await prisma.billingInvoice.findMany({ where: { cabinetId: cabinet.id }, orderBy: { createdAt: 'desc' } }));
  } catch (err) { next(err); }
});

/** Super Admin: invoices of every cabinet, with totals per status. */
router.get('/admin/invoices', authenticate, requireRoles('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const q = z.object({ status: z.string().optional(), cabinetId: z.string().optional() }).parse(req.query);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.cabinetId) where.cabinetId = q.cabinetId;
    const [invoices, grouped] = await Promise.all([
      prisma.billingInvoice.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300, include: { cabinet: { select: { id: true, name: true } } } }),
      prisma.billingInvoice.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true } }),
    ]);
    sendSuccess(res, {
      items: invoices.map(({ cabinet, ...invoice }) => ({ ...invoice, cabinetName: cabinet?.name || null })),
      totals: Object.fromEntries(grouped.map(group => [group.status, { count: group._count._all, amount: Number(group._sum.amount || 0) }])),
    });
  } catch (err) { next(err); }
});

/** Activates the plan after a confirmed payment (idempotent: a payment already recorded is not applied twice). */
async function applyPayment(invoiceId: string, extra: { reference?: string | null }) {
  const invoice = await prisma.billingInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === 'PAID') return invoice;
  const plan = await prisma.plan.findUnique({ where: { code: invoice.plan } });
  if (!plan) return invoice;
  const cabinet = await prisma.cabinet.findUnique({ where: { id: invoice.cabinetId } });
  // A renewal paid before the end of the current period extends it, it does not cut it short.
  const from = cabinet?.currentPeriodEnd && cabinet.currentPeriodEnd > new Date() && cabinet.plan === plan.code ? new Date(cabinet.currentPeriodEnd) : new Date();
  const periodEnd = new Date(from);
  periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);
  await prisma.$transaction([
    prisma.cabinet.update({ where: { id: invoice.cabinetId }, data: { plan: plan.code, isActive: true, subscriptionStatus: 'ACTIVE', currentPeriodEnd: periodEnd, ...planQuotas(plan) } }),
    prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date(), periodEnd, reference: extra.reference ?? invoice.reference } }),
    prisma.subscriptionHistory.create({ data: { cabinetId: invoice.cabinetId, plan: plan.code, status: 'ACTIVE', startedAt: new Date(), periodEnd } }),
  ]);
  void writeAuditLog({ cabinetId: invoice.cabinetId, action: 'PAYMENT_RECEIVED', method: 'CMI', path: '/api/billing/cmi/callback', status: 200 });
  return invoice;
}

const publicApi = (req: Request) => `${(process.env.API_PUBLIC_URL || `${frontendUrl}/api`).replace(/\/$/, '')}`;

/**
 * Online payment by card through the CMI (Moroccan interbank gateway): returns the signed form the browser
 * posts to the CMI page. The plan is activated only by the CMI callback, never by the return of the browser.
 */
router.post('/checkout', authenticate, requireRoles('OWNER'), requirePermissions('MANAGE_SUBSCRIPTION'), async (req, res, next) => {
  try {
    if (!cmiConfigured()) throw new AppError('Paiement en ligne non configuré : contactez Cabinet Pro pour régler par virement.', 503);
    const { planCode } = z.object({ planCode: z.string().min(1) }).parse(req.body);
    const cabinet = await getAdminCabinet(req);
    const plan = await prisma.plan.findUnique({ where: { code: planCode, isActive: true, deletedAt: null } });
    if (!plan) throw new AppError('Plan indisponible', 404);
    const amount = Number(plan.monthlyPrice) * plan.durationMonths;
    if (!(amount > 0)) throw new AppError('Ce plan n’a pas de prix', 400);

    const invoice = await prisma.billingInvoice.create({ data: { cabinetId: cabinet.id, plan: plan.code, amount, currency: 'MAD', status: 'PENDING', paymentMethod: 'CMI' } });
    const api = publicApi(req);
    const form = cmiForm({
      orderId: invoice.id, amount,
      okUrl: `${api}/billing/cmi/return?result=ok`, failUrl: `${api}/billing/cmi/return?result=fail`,
      callbackUrl: `${api}/billing/cmi/callback`, shopUrl: `${frontendUrl}/pricing`,
      email: cabinet.email || req.user!.email, phone: cabinet.phone, name: cabinet.name,
    });
    sendSuccess(res, { gateway: form, invoiceId: invoice.id });
  } catch (err) { next(err); }
});

/**
 * CMI server-to-server notification. The answer is read by the CMI: "ACTION=POSTAUTH" captures the authorised
 * amount, "APPROVED" acknowledges a declined payment, "FAILURE" rejects a message whose signature is wrong.
 */
router.post('/cmi/callback', async (req: Request, res: Response) => {
  const params = Object.fromEntries(Object.entries(req.body || {}).map(([k, v]) => [k, String(v)])) as Record<string, string>;
  res.type('text/plain');
  if (!cmiConfigured() || !verifyCmiHash(params, cmiConfig().storeKey)) {
    void writeAuditLog({ action: 'PAYMENT_BAD_SIGNATURE', method: 'CMI', path: '/api/billing/cmi/callback', status: 400 });
    return res.send('FAILURE');
  }
  try {
    const invoice = await prisma.billingInvoice.findUnique({ where: { id: params.oid || '' } });
    if (!invoice) return res.send('FAILURE');
    const approved = params.ProcReturnCode === '00' && (params.Response || '').toLowerCase() === 'approved';
    if (approved && Math.abs(Number(params.amount) - Number(invoice.amount)) > 0.009) {
      await prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: 'FAILED', reference: `montant reçu ${params.amount}` } });
      return res.send('FAILURE');
    }
    if (approved) {
      await applyPayment(invoice.id, { reference: params.TransId || params.AuthCode || null });
      return res.send('ACTION=POSTAUTH');
    }
    if (invoice.status === 'PENDING') {
      await prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: 'FAILED', reference: (params.ErrMsg || params.ProcReturnCode || '').slice(0, 180) || null } });
      void writeAuditLog({ cabinetId: invoice.cabinetId, action: 'PAYMENT_FAILED', method: 'CMI', path: '/api/billing/cmi/callback', status: 200 });
    }
    return res.send('APPROVED');
  } catch {
    return res.send('FAILURE');
  }
});

/** Browser back from the CMI page (a POST, which the single-page app cannot receive): redirect to the plans page. */
router.all('/cmi/return', (req: Request, res: Response) => {
  res.redirect(303, `${frontendUrl}/pricing?billing=${req.query.result === 'ok' ? 'success' : 'failed'}`);
});

export default router;
