import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { authenticate, requirePermissions, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { sendSuccess } from '../utils/response';
import { writeAuditLog } from '../utils/audit';
import { planQuotas } from '../services/cabinet-setup';

const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

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

router.post('/checkout', authenticate, requireRoles('OWNER'), requirePermissions('MANAGE_SUBSCRIPTION'), async (req, res, next) => {
  try {
    if (!stripe) throw new AppError('Paiement Stripe non configuré', 503);
    const { planCode } = z.object({ planCode: z.string().min(1) }).parse(req.body);
    const cabinet = await getAdminCabinet(req);
    const plan = await prisma.plan.findUnique({ where: { code: planCode, isActive: true, deletedAt: null } });
    if (!plan) throw new AppError('Plan indisponible', 404);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price_data: { currency: 'mad', product_data: { name: `Abonnement ${plan.name}` }, unit_amount: Math.round(Number(plan.monthlyPrice) * 100), recurring: { interval: 'month', interval_count: plan.durationMonths } }, quantity: 1 }],
      customer_email: cabinet.email || undefined,
      success_url: `${frontendUrl}/settings?billing=success`,
      cancel_url: `${frontendUrl}/settings?billing=cancelled`,
      metadata: { cabinetId: cabinet.id, planCode: plan.code },
      subscription_data: { metadata: { cabinetId: cabinet.id, planCode: plan.code } },
    });

    await prisma.billingInvoice.create({ data: { cabinetId: cabinet.id, stripeSessionId: session.id, plan: plan.code, amount: Number(plan.monthlyPrice), currency: 'MAD', status: 'PENDING' } });
    sendSuccess(res, { checkoutUrl: session.url });
  } catch (err) { next(err); }
});

router.post('/webhook', async (req: Request, res: Response) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook non configuré');
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'] as string, process.env.STRIPE_WEBHOOK_SECRET);
  } catch { return res.status(400).send('Signature Stripe invalide'); }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const cabinetId = session.metadata?.cabinetId;
      const planCode = session.metadata?.planCode;
      if (cabinetId && planCode) {
        const plan = await prisma.plan.findUnique({ where: { code: planCode } });
        if (plan) {
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);
          await prisma.$transaction([
            prisma.cabinet.update({ where: { id: cabinetId }, data: { plan: plan.code, isActive: true, subscriptionStatus: 'ACTIVE', currentPeriodEnd: periodEnd, ...planQuotas(plan) } }),
            prisma.billingInvoice.updateMany({ where: { stripeSessionId: session.id }, data: { status: 'PAID', paidAt: new Date(), periodEnd } }),
            prisma.subscriptionHistory.create({ data: { cabinetId, plan: plan.code, status: 'ACTIVE', startedAt: new Date(), periodEnd } }),
          ]);
        }
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
      const subscription = subscriptionId ? await stripe.subscriptions.retrieve(String(subscriptionId)) : null;
      const cabinetId = subscription?.metadata?.cabinetId;
      const planCode = subscription?.metadata?.planCode;
      if (cabinetId && planCode) {
        const plan = await prisma.plan.findUnique({ where: { code: planCode } });
        if (plan) {
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);
          await prisma.cabinet.update({ where: { id: cabinetId }, data: { isActive: true, subscriptionStatus: 'ACTIVE', currentPeriodEnd: periodEnd } });
          await prisma.billingInvoice.upsert({ where: { stripeInvoiceId: invoice.id }, update: { status: 'PAID', paidAt: new Date(), periodEnd, invoiceUrl: invoice.hosted_invoice_url || null }, create: { cabinetId, stripeInvoiceId: invoice.id, plan: plan.code, amount: Number(invoice.amount_paid || 0) / 100, currency: 'MAD', status: 'PAID', paidAt: new Date(), periodEnd, invoiceUrl: invoice.hosted_invoice_url || null } });
          await prisma.subscriptionHistory.create({ data: { cabinetId, plan: plan.code, status: 'ACTIVE', startedAt: new Date(), periodEnd } });
        }
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
      const subscription = subscriptionId ? await stripe.subscriptions.retrieve(String(subscriptionId)) : null;
      const cabinetId = subscription?.metadata?.cabinetId;
      if (cabinetId) {
        await prisma.cabinet.update({ where: { id: cabinetId }, data: { subscriptionStatus: 'PAST_DUE' } });
        await prisma.billingInvoice.upsert({ where: { stripeInvoiceId: invoice.id }, update: { status: 'FAILED' }, create: { cabinetId, stripeInvoiceId: invoice.id, plan: subscription?.metadata?.planCode || 'UNKNOWN', amount: Number(invoice.amount_due || 0) / 100, currency: 'MAD', status: 'FAILED' } });
        void writeAuditLog({ cabinetId, action: 'PAYMENT_FAILED', method: 'WEBHOOK', path: '/api/billing/webhook', status: 200 });
      }
    }
    res.json({ received: true });
  } catch { res.status(500).send('Erreur webhook'); }
});

export default router;
