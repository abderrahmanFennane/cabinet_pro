import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { findPatientOr404, nextNumber, toNumber } from '../../utils/patient-scope';
import { lineTotal, quoteBalance, recomputeInvoice } from '../../utils/billing';

// Act catalogue at /api/cabinets/:cabinetId/acts; invoices, payments and quotes at /api/cabinets/:cabinetId/billing
const router = Router({ mergeParams: true });

const patientSelect = { select: { id: true, firstName: true, lastName: true, phone: true, cin: true, coverage: true, coverageNumber: true, insuredName: true, complementaryInsurance: true, complementaryNumber: true, address: true } };
const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'CHECK'] as const;

const itemInput = z.object({
  actId: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  label: z.string().trim().min(1, 'Libellé requis'),
  teeth: z.string().nullable().optional(),
  faces: z.string().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0),
});

// ─── Act catalogue (F-FAC-01, F-DEN-05) ───

const actSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1),
  price: z.number().min(0),
  specialty: z.string().default('GENERAL'),
  category: z.string().default('AUTRE'),
  scope: z.enum(['NONE', 'TOOTH', 'TEETH', 'QUADRANT', 'MOUTH']).default('NONE'),
  usesFaces: z.boolean().default(false),
  resultingState: z.string().nullable().optional(),
  ngap: z.string().trim().max(20).nullable().optional(),
  isActive: z.boolean().default(true),
});

router.get('/acts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ specialty: z.string().optional(), all: z.enum(['true', 'false']).optional() }).parse(req.query);
    const acts = await prisma.act.findMany({
      where: { cabinetId: req.params.cabinetId, deletedAt: null, ...(q.all === 'true' ? {} : { isActive: true }), ...(q.specialty ? { specialty: q.specialty } : {}) },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    sendSuccess(res, acts);
  } catch (err) { next(err); }
});

router.post('/acts', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = actSchema.parse(req.body);
    sendSuccess(res, await prisma.act.create({ data: { ...data, cabinetId: req.params.cabinetId } }), 'Acte ajouté', undefined, 201);
  } catch (err) { next(err); }
});

router.patch('/acts/:id', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = actSchema.partial().parse(req.body);
    const act = await prisma.act.findFirst({ where: { id: req.params.id, cabinetId: req.params.cabinetId, deletedAt: null } });
    if (!act) throw new AppError('Acte introuvable', 404);
    sendSuccess(res, await prisma.act.update({ where: { id: act.id }, data }), 'Acte mis à jour');
  } catch (err) { next(err); }
});

router.delete('/acts/:id', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const act = await prisma.act.findFirst({ where: { id: req.params.id, cabinetId: req.params.cabinetId, deletedAt: null } });
    if (!act) throw new AppError('Acte introuvable', 404);
    await prisma.act.update({ where: { id: act.id }, data: { deletedAt: new Date(), isActive: false, code: `${act.code}#${Date.now()}` } });
    sendSuccess(res, null, 'Acte supprimé');
  } catch (err) { next(err); }
});

// ─── Invoices (F-FAC-01, F-FAC-02) ───

const billing = Router({ mergeParams: true });
billing.use(requirePermissions('MANAGE_BILLING'));

billing.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ patientId: z.string().optional(), status: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).parse(req.query);
    const where: any = { cabinetId: req.params.cabinetId };
    if (q.patientId) where.patientId = q.patientId;
    if (q.status) where.status = q.status;
    if (q.from || q.to) where.date = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(q.to) } : {}) };
    if (req.user!.role === 'PRACTITIONER') where.practitionerId = req.user!.id;
    sendSuccess(res, await prisma.invoice.findMany({ where, include: { patient: patientSelect }, orderBy: { date: 'desc' }, take: 300 }));
  } catch (err) { next(err); }
});

async function findInvoice(req: Request) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, cabinetId: req.params.cabinetId },
    include: { patient: patientSelect, items: { orderBy: { createdAt: 'asc' } }, payments: { orderBy: { paidAt: 'asc' } } },
  });
  if (!invoice) throw new AppError('Facture introuvable', 404);
  return invoice;
}

billing.get('/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await findInvoice(req));
  } catch (err) { next(err); }
});

billing.post('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ patientId: z.string().min(1), items: z.array(itemInput).min(1, 'Ajoutez au moins une ligne'), notes: z.string().nullable().optional() }).parse(req.body);
    await findPatientOr404(req, data.patientId);
    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          cabinetId: req.params.cabinetId, patientId: data.patientId, notes: data.notes,
          practitionerId: req.user!.role === 'ASSISTANT' || req.user!.role === 'SUPER_ADMIN' ? null : req.user!.id,
          number: await nextNumber(tx, req.params.cabinetId, 'invoice'),
          items: { create: data.items.map(item => ({ ...item, total: lineTotal(item.unitPrice, item.quantity) })) },
        },
      });
      return recomputeInvoice(tx, created.id);
    });
    sendSuccess(res, invoice, 'Facture créée', undefined, 201);
  } catch (err) { next(err); }
});

billing.post('/invoices/:id/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await findInvoice(req);
    if (invoice.status === 'CANCELLED') throw new AppError('Facture annulée', 409);
    const item = itemInput.parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.create({ data: { ...item, invoiceId: invoice.id, total: lineTotal(item.unitPrice, item.quantity) } });
      await recomputeInvoice(tx, invoice.id);
    });
    sendSuccess(res, await findInvoice(req), 'Ligne ajoutée');
  } catch (err) { next(err); }
});

billing.delete('/invoices/:id/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await findInvoice(req);
    if (!invoice.items.some(item => item.id === req.params.itemId)) throw new AppError('Ligne introuvable', 404);
    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.delete({ where: { id: req.params.itemId } });
      await recomputeInvoice(tx, invoice.id);
    });
    sendSuccess(res, await findInvoice(req), 'Ligne supprimée');
  } catch (err) { next(err); }
});

billing.post('/invoices/:id/cancel', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await findInvoice(req);
    if (invoice.payments.length) throw new AppError('Une facture avec des paiements ne peut pas être annulée', 409);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'CANCELLED' } });
    sendSuccess(res, await findInvoice(req), 'Facture annulée');
  } catch (err) { next(err); }
});

// ─── Payments: cash, card, transfer, check; partial payments allowed ───

billing.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ from: z.string(), to: z.string() }).parse(req.query);
    const payments = await prisma.payment.findMany({
      where: { cabinetId: req.params.cabinetId, paidAt: { gte: new Date(q.from), lt: new Date(q.to) } },
      include: { patient: { select: { id: true, firstName: true, lastName: true } }, invoice: { select: { number: true } }, quote: { select: { number: true } } },
      orderBy: { paidAt: 'desc' },
    });
    const byMethod = Object.fromEntries(PAYMENT_METHODS.map(method => [method, payments.filter(p => p.method === method).reduce((s, p) => s + toNumber(p.amount), 0)]));
    sendSuccess(res, { items: payments, byMethod, total: payments.reduce((s, p) => s + toNumber(p.amount), 0) });
  } catch (err) { next(err); }
});

billing.post('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      patientId: z.string().min(1),
      invoiceId: z.string().nullable().optional(),
      quoteId: z.string().nullable().optional(),
      method: z.enum(PAYMENT_METHODS).default('CASH'),
      amount: z.number().positive('Montant invalide'),
      reference: z.string().nullable().optional(),
    }).refine(v => !!v.invoiceId !== !!v.quoteId, 'Choisissez une facture ou un devis').parse(req.body);
    await findPatientOr404(req, data.patientId);

    const payment = await prisma.$transaction(async (tx) => {
      if (data.invoiceId) {
        const invoice = await tx.invoice.findFirst({ where: { id: data.invoiceId, cabinetId: req.params.cabinetId, patientId: data.patientId } });
        if (!invoice || invoice.status === 'CANCELLED') throw new AppError('Facture introuvable ou annulée', 400);
        const remaining = toNumber(invoice.total) - toNumber(invoice.paid);
        if (data.amount > remaining + 0.001) throw new AppError(`Le montant dépasse le reste à payer (${remaining.toFixed(2)})`, 400);
      } else {
        const quote = await tx.quote.findFirst({ where: { id: data.quoteId!, cabinetId: req.params.cabinetId, patientId: data.patientId } });
        if (!quote || quote.status !== 'ACCEPTED') throw new AppError('Le devis doit être accepté avant un paiement', 400);
        const { remaining } = await quoteBalance(tx, quote.id);
        if (data.amount > remaining + 0.001) throw new AppError(`Le montant dépasse le reste à payer (${remaining.toFixed(2)})`, 400);
      }
      const created = await tx.payment.create({ data: { ...data, cabinetId: req.params.cabinetId, receivedById: req.user!.id } });
      if (data.invoiceId) await recomputeInvoice(tx, data.invoiceId);
      return created;
    });
    sendSuccess(res, payment, 'Paiement enregistré', undefined, 201);
  } catch (err) { next(err); }
});

// ─── Quotes and payment schedules (F-FAC-03, F-DEN-07) ───

const quotes = Router({ mergeParams: true });
quotes.use(requirePermissions('DENTAL_TREATMENT_PLAN'));

const installmentSchema = z.array(z.object({ dueDate: z.string(), amount: z.number().min(0) }));

async function serializeQuote(quoteId: string) {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { patient: patientSelect, items: true, payments: { orderBy: { paidAt: 'asc' } }, treatmentPlan: { select: { id: true, title: true, status: true } } },
  });
  const balance = await quoteBalance(prisma, quote.id);
  let installments: { dueDate: string; amount: number }[] = [];
  try { installments = quote.installments ? JSON.parse(quote.installments) : []; } catch { installments = []; }
  // Each installment is covered in due-date order by what has been paid so far.
  let covered = balance.paid;
  const schedule = installments.map(line => {
    const paid = Math.min(line.amount, Math.max(0, covered));
    covered -= line.amount;
    return { ...line, paid, status: paid + 0.001 >= line.amount ? 'PAID' : new Date(line.dueDate) < new Date() ? 'LATE' : 'DUE' };
  });
  return { ...quote, ...balance, installments: schedule };
}

async function findQuote(req: Request) {
  const quote = await prisma.quote.findFirst({ where: { id: req.params.id, cabinetId: req.params.cabinetId } });
  if (!quote) throw new AppError('Devis introuvable', 404);
  return quote;
}

quotes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ patientId: z.string().optional(), status: z.string().optional() }).parse(req.query);
    const list = await prisma.quote.findMany({
      where: { cabinetId: req.params.cabinetId, ...(q.patientId ? { patientId: q.patientId } : {}), ...(q.status ? { status: q.status } : {}) },
      include: { patient: patientSelect, payments: { select: { amount: true } } },
      orderBy: { date: 'desc' },
      take: 300,
    });
    sendSuccess(res, list.map(({ payments, ...quote }) => {
      const paid = payments.reduce((s, p) => s + toNumber(p.amount), 0);
      return { ...quote, paid, remaining: Math.max(0, toNumber(quote.total) - paid) };
    }));
  } catch (err) { next(err); }
});

quotes.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await findQuote(req);
    sendSuccess(res, await serializeQuote(quote.id));
  } catch (err) { next(err); }
});

quotes.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ patientId: z.string().min(1), items: z.array(itemInput).min(1), notes: z.string().nullable().optional(), validDays: z.number().int().min(1).max(365).default(30) }).parse(req.body);
    await findPatientOr404(req, data.patientId);
    const quote = await prisma.$transaction(async (tx) => tx.quote.create({
      data: {
        cabinetId: req.params.cabinetId, patientId: data.patientId, notes: data.notes,
        practitionerId: req.user!.role === 'ASSISTANT' || req.user!.role === 'SUPER_ADMIN' ? null : req.user!.id,
        number: await nextNumber(tx, req.params.cabinetId, 'quote'),
        validUntil: new Date(Date.now() + data.validDays * 86_400_000),
        total: data.items.reduce((s, item) => s + lineTotal(item.unitPrice, item.quantity), 0),
        items: { create: data.items.map(item => ({ ...item, total: lineTotal(item.unitPrice, item.quantity) })) },
      },
    }));
    sendSuccess(res, await serializeQuote(quote.id), 'Devis créé', undefined, 201);
  } catch (err) { next(err); }
});

quotes.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await findQuote(req);
    const data = z.object({
      status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']).optional(),
      notes: z.string().nullable().optional(),
      validUntil: z.string().nullable().optional(),
      installments: installmentSchema.optional(),
    }).parse(req.body);
    if (quote.status === 'ACCEPTED' && data.status && data.status !== 'ACCEPTED') {
      const paid = await prisma.payment.count({ where: { quoteId: quote.id } });
      if (paid) throw new AppError('Un devis accepté avec des paiements ne peut plus changer de statut', 409);
    }
    if (data.installments) {
      const sum = data.installments.reduce((s, line) => s + line.amount, 0);
      if (Math.abs(sum - toNumber(quote.total)) > 0.01) throw new AppError(`L’échéancier (${sum.toFixed(2)}) doit égaler le total du devis (${toNumber(quote.total).toFixed(2)})`, 400);
    }
    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: data.status,
          notes: data.notes,
          validUntil: data.validUntil === undefined ? undefined : data.validUntil ? new Date(data.validUntil) : null,
          installments: data.installments ? JSON.stringify(data.installments) : undefined,
          acceptedAt: data.status === 'ACCEPTED' && quote.status !== 'ACCEPTED' ? new Date() : undefined,
        },
      });
      if (quote.treatmentPlanId && data.status === 'ACCEPTED') {
        await tx.treatmentPlan.updateMany({ where: { id: quote.treatmentPlanId, status: 'PROPOSED' }, data: { status: 'ACCEPTED' } });
      }
    });
    sendSuccess(res, await serializeQuote(quote.id), 'Devis mis à jour');
  } catch (err) { next(err); }
});

/** Splits the quote total into `count` monthly installments starting at `firstDate`. */
quotes.post('/:id/installments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await findQuote(req);
    const { count, firstDate } = z.object({ count: z.number().int().min(1).max(36), firstDate: z.string() }).parse(req.body);
    const total = toNumber(quote.total);
    const base = Math.floor((total / count) * 100) / 100;
    const start = new Date(firstDate);
    const lines = Array.from({ length: count }, (_, i) => {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i);
      const amount = i === count - 1 ? Math.round((total - base * (count - 1)) * 100) / 100 : base;
      return { dueDate: due.toISOString().slice(0, 10), amount };
    });
    await prisma.quote.update({ where: { id: quote.id }, data: { installments: JSON.stringify(lines) } });
    sendSuccess(res, await serializeQuote(quote.id), 'Échéancier créé');
  } catch (err) { next(err); }
});

billing.use('/quotes', quotes);

/** Invoices, payments and quotes, mounted at /api/cabinets/:cabinetId/billing. */
export const billingRouter = billing;
/** Act catalogue, mounted at /api/cabinets/:cabinetId (routes under /acts). */
export default router;
