import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { findPatientOr404, nextNumber, toNumber } from '../../utils/patient-scope';
import { lineTotal, quoteBalance, recomputeInvoice } from '../../utils/billing';
import ExcelJS from 'exceljs';
import { formatDate, formatTime, monthlyUsage, sendMessage } from '../../services/messaging';
import { dayRange, localDay } from '../../utils/local-day';
import { copyDefaultActs } from '../../services/cabinet-setup';

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

/** Adds the default acts of a specialty the cabinet does not have yet; existing acts and prices stay as they are. */
router.post('/acts/import-defaults', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { specialty } = z.object({ specialty: z.string().min(1).max(40) }).parse(req.body);
    const added = await prisma.$transaction(tx => copyDefaultActs(tx, req.params.cabinetId, specialty));
    sendSuccess(res, { added }, added ? `${added} acte(s) ajouté(s)` : 'Le catalogue est déjà complet');
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

// ─── Unpaid balances: list and reminders to the patient ───

const money = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Payment reminder text: amount, invoice number and cabinet only (no act or diagnosis). */
function paymentReminderText(invoice: { number: string; date: Date; total: Parameters<typeof toNumber>[0]; paid: Parameters<typeof toNumber>[0]; patient: { firstName: string } }, cabinet: { name: string; phone: string | null; currency: string }) {
  const balance = toNumber(invoice.total) - toNumber(invoice.paid);
  return `Bonjour ${invoice.patient.firstName}, le ${cabinet.name} vous rappelle un reste à payer de ${money(balance)} ${cabinet.currency === 'MAD' ? 'DH' : cabinet.currency}`
    + ` (facture ${invoice.number} du ${formatDate(invoice.date)}).${cabinet.phone ? ` Pour toute question : ${cabinet.phone}.` : ''} Merci.`;
}

billing.get('/unpaid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = { cabinetId: req.params.cabinetId, status: { in: ['OPEN', 'PARTIAL'] } };
    if (req.user!.role === 'PRACTITIONER') where.practitionerId = req.user!.id;
    const [invoices, cabinet] = await Promise.all([
      prisma.invoice.findMany({ where, include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } }, orderBy: { date: 'asc' }, take: 1000 }),
      prisma.cabinet.findUnique({ where: { id: req.params.cabinetId }, select: { name: true, phone: true, currency: true } }),
    ]);
    const now = Date.now();
    const rows = invoices
      .map(inv => ({
        id: inv.id, number: inv.number, date: inv.date, total: toNumber(inv.total), paid: toNumber(inv.paid),
        balance: Math.round((toNumber(inv.total) - toNumber(inv.paid)) * 100) / 100,
        days: Math.floor((now - inv.date.getTime()) / 86_400_000),
        reminderCount: inv.reminderCount, lastReminderAt: inv.lastReminderAt, patient: inv.patient,
        message: paymentReminderText(inv, cabinet!),
      }))
      .filter(r => r.balance > 0.009);
    const bucket = (min: number, max: number) => rows.filter(r => r.days >= min && r.days <= max).reduce((s, r) => s + r.balance, 0);
    sendSuccess(res, {
      total: rows.reduce((s, r) => s + r.balance, 0),
      buckets: { recent: bucket(0, 30), month: bucket(31, 90), old: bucket(91, 100_000) },
      rows: rows.sort((a, b) => b.days - a.days),
    });
  } catch (err) { next(err); }
});

/**
 * Reminds the patient of the balance. WHATSAPP / SMS are sent by the platform (counts in the monthly allowance);
 * LINK records a reminder the user sent from their own WhatsApp (wa.me link opened in the browser).
 */
billing.post('/invoices/:id/remind', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel } = z.object({ channel: z.enum(['WHATSAPP', 'SMS', 'LINK']) }).parse(req.body);
    const invoice = await findInvoice(req);
    if (!['OPEN', 'PARTIAL'].includes(invoice.status)) throw new AppError('Cette facture est déjà réglée', 400);
    if (req.user!.role === 'PRACTITIONER' && invoice.practitionerId !== req.user!.id) throw new AppError('Facture d’un confrère', 403);
    const cabinet = await prisma.cabinet.findUniqueOrThrow({ where: { id: req.params.cabinetId } });
    let status = 'SENT';
    if (channel !== 'LINK') {
      if (!invoice.patient.phone) throw new AppError('Pas de téléphone sur la fiche du patient', 400);
      if ((await monthlyUsage(cabinet.id)) + 1 > cabinet.monthlyMessages) throw new AppError('Quota mensuel de messages atteint (voir votre abonnement)', 403);
      const message = await sendMessage({
        kind: 'PAYMENT_REMINDER', channel, toPhone: invoice.patient.phone, cabinetId: cabinet.id, fromUserId: req.user!.id,
        body: paymentReminderText(invoice, cabinet),
        templateParams: [invoice.patient.firstName, cabinet.name, `${money(toNumber(invoice.total) - toNumber(invoice.paid))} DH`, invoice.number],
      });
      status = message?.status || 'FAILED';
      if (status === 'FAILED') throw new AppError(`Envoi impossible : ${message?.error || 'erreur du fournisseur'}`, 502);
    }
    const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: new Date() } });
    sendSuccess(res, { reminderCount: updated.reminderCount, lastReminderAt: updated.lastReminderAt, status },
      status === 'LOGGED' ? 'Relance enregistrée (envoi automatique non configuré : message journalisé)' : 'Relance envoyée');
  } catch (err) { next(err); }
});

// ─── Daily cash closing ───

const dayParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');
const noPractitioner = (req: Request) => {
  if (req.user!.role === 'PRACTITIONER') throw new AppError('La caisse est tenue par le titulaire ou l’assistante', 403);
};

async function cashDay(cabinetId: string, day: string) {
  const { start, end } = dayRange(day);
  const payments = await prisma.payment.findMany({
    where: { cabinetId, paidAt: { gte: start, lt: end } },
    include: { patient: { select: { firstName: true, lastName: true } }, invoice: { select: { number: true } } },
    orderBy: { paidAt: 'asc' },
  });
  const totals: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0, CHECK: 0 };
  for (const p of payments) totals[p.method] = Math.round(((totals[p.method] || 0) + toNumber(p.amount)) * 100) / 100;
  return { payments, totals, total: Object.values(totals).reduce((a, b) => a + b, 0) };
}

billing.get('/cash-day', async (req: Request, res: Response, next: NextFunction) => {
  try {
    noPractitioner(req);
    const day = req.query.day ? dayParam.parse(req.query.day) : localDay();
    const [{ payments, totals, total }, closing] = await Promise.all([
      cashDay(req.params.cabinetId, day),
      prisma.cashClosing.findUnique({ where: { cabinetId_day: { cabinetId: req.params.cabinetId, day: new Date(`${day}T00:00:00Z`) } } }),
    ]);
    const users = closing ? await prisma.user.findMany({ where: { id: closing.closedById }, select: { id: true, title: true, firstName: true, lastName: true } }) : [];
    sendSuccess(res, {
      day, totals, total,
      payments: payments.map(p => ({ id: p.id, paidAt: p.paidAt, method: p.method, amount: toNumber(p.amount), reference: p.reference, patient: p.patient, invoiceNumber: p.invoice?.number ?? null })),
      closing: closing && { ...closing, totals: JSON.parse(closing.totals), expectedCash: toNumber(closing.expectedCash), countedCash: toNumber(closing.countedCash), difference: toNumber(closing.difference), closedBy: users[0] ?? null },
    });
  } catch (err) { next(err); }
});

/** Closes the day: the cash counted in the drawer against the cash payments recorded. The owner can redo a closing. */
billing.post('/cash-day', async (req: Request, res: Response, next: NextFunction) => {
  try {
    noPractitioner(req);
    const body = z.object({ day: dayParam, countedCash: z.number().min(0).max(10_000_000), notes: z.string().max(1000).optional() }).parse(req.body);
    if (body.day > localDay()) throw new AppError('Impossible de clôturer un jour à venir', 400);
    const cabinetId = req.params.cabinetId;
    const key = { cabinetId, day: new Date(`${body.day}T00:00:00Z`) };
    const existing = await prisma.cashClosing.findUnique({ where: { cabinetId_day: key } });
    if (existing && req.user!.role !== 'OWNER') throw new AppError('Cette journée est déjà clôturée (seul le titulaire peut la refaire)', 409);
    const { totals } = await cashDay(cabinetId, body.day);
    const data = {
      totals: JSON.stringify(totals), expectedCash: totals.CASH, countedCash: body.countedCash,
      difference: Math.round((body.countedCash - totals.CASH) * 100) / 100, notes: body.notes || null, closedById: req.user!.id,
    };
    const closing = existing
      ? await prisma.cashClosing.update({ where: { id: existing.id }, data })
      : await prisma.cashClosing.create({ data: { ...key, ...data } });
    sendSuccess(res, { ...closing, difference: toNumber(closing.difference) }, Number(closing.difference) === 0 ? 'Caisse clôturée : aucun écart' : `Caisse clôturée avec un écart de ${money(toNumber(closing.difference))}`);
  } catch (err) { next(err); }
});

// ─── Accounting export (Excel): invoices, payments, monthly summary, cash closings ───

billing.get('/export', requirePermissions('VIEW_REPORTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ from: dayParam, to: dayParam }).parse(req.query);
    if (q.from > q.to) throw new AppError('La date de début est après la date de fin', 400);
    const cabinetId = req.params.cabinetId;
    const start = dayRange(q.from).start, end = dayRange(q.to).end;
    const [cabinet, invoices, payments, closings, users] = await Promise.all([
      prisma.cabinet.findUniqueOrThrow({ where: { id: cabinetId }, select: { name: true, currency: true } }),
      prisma.invoice.findMany({ where: { cabinetId, date: { gte: start, lt: end } }, include: { patient: { select: { firstName: true, lastName: true, cin: true, coverage: true } } }, orderBy: { date: 'asc' } }),
      prisma.payment.findMany({ where: { cabinetId, paidAt: { gte: start, lt: end } }, include: { patient: { select: { firstName: true, lastName: true } }, invoice: { select: { number: true } } }, orderBy: { paidAt: 'asc' } }),
      prisma.cashClosing.findMany({ where: { cabinetId, day: { gte: new Date(`${q.from}T00:00:00Z`), lte: new Date(`${q.to}T00:00:00Z`) } }, orderBy: { day: 'asc' } }),
      prisma.user.findMany({ where: { cabinetId }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const who = (id?: string | null) => { const u = users.find(x => x.id === id); return u ? `${u.firstName} ${u.lastName}` : ''; };
    const METHOD: Record<string, string> = { CASH: 'Espèces', CARD: 'Carte', TRANSFER: 'Virement', CHECK: 'Chèque' };
    const STATUS: Record<string, string> = { OPEN: 'Ouverte', PARTIAL: 'Partielle', PAID: 'Payée', CANCELLED: 'Annulée' };
    const localDate = (d: Date) => new Date(`${localDay(d)}T00:00:00Z`);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Cabinet Pro';
    const sheet = (name: string, columns: { header: string; key: string; width: number; money?: boolean; date?: boolean }[], rows: Record<string, unknown>[]) => {
      const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: '#,##0.00' } : c.date ? { numFmt: 'dd/mm/yyyy' } : {} }));
      ws.getRow(1).font = { bold: true };
      ws.addRows(rows);
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
      return ws;
    };

    sheet('Factures', [
      { header: 'N° facture', key: 'number', width: 16 }, { header: 'Date', key: 'date', width: 12, date: true },
      { header: 'Patient', key: 'patient', width: 28 }, { header: 'CIN', key: 'cin', width: 12 }, { header: 'Couverture', key: 'coverage', width: 14 },
      { header: 'Total', key: 'total', width: 12, money: true }, { header: 'Payé', key: 'paid', width: 12, money: true },
      { header: 'Reste', key: 'balance', width: 12, money: true }, { header: 'Statut', key: 'status', width: 12 }, { header: 'Médecin', key: 'doctor', width: 20 },
    ], invoices.map(i => ({
      number: i.number, date: localDate(i.date), patient: `${i.patient.lastName} ${i.patient.firstName}`, cin: i.patient.cin, coverage: i.patient.coverage,
      total: toNumber(i.total), paid: toNumber(i.paid), balance: i.status === 'CANCELLED' ? 0 : toNumber(i.total) - toNumber(i.paid),
      status: STATUS[i.status] || i.status, doctor: who(i.practitionerId),
    })));

    sheet('Encaissements', [
      { header: 'Date', key: 'date', width: 12, date: true }, { header: 'Heure', key: 'time', width: 8 }, { header: 'Patient', key: 'patient', width: 28 },
      { header: 'Facture', key: 'invoice', width: 16 }, { header: 'Mode', key: 'method', width: 12 }, { header: 'Montant', key: 'amount', width: 12, money: true },
      { header: 'Référence', key: 'reference', width: 18 }, { header: 'Encaissé par', key: 'by', width: 20 },
    ], payments.map(p => ({
      date: localDate(p.paidAt), time: formatTime(p.paidAt), patient: `${p.patient.lastName} ${p.patient.firstName}`, invoice: p.invoice?.number || '',
      method: METHOD[p.method] || p.method, amount: toNumber(p.amount), reference: p.reference || '', by: who(p.receivedById),
    })));

    // Monthly totals by payment method
    const months = new Map<string, Record<string, number>>();
    for (const p of payments) {
      const m = localDay(p.paidAt).slice(0, 7);
      const row = months.get(m) || { CASH: 0, CARD: 0, TRANSFER: 0, CHECK: 0 };
      row[p.method] = (row[p.method] || 0) + toNumber(p.amount);
      months.set(m, row);
    }
    const invoiced = new Map<string, number>();
    for (const i of invoices) if (i.status !== 'CANCELLED') { const m = localDay(i.date).slice(0, 7); invoiced.set(m, (invoiced.get(m) || 0) + toNumber(i.total)); }
    const monthKeys = [...new Set([...months.keys(), ...invoiced.keys()])].sort();
    const summary = sheet('Récapitulatif', [
      { header: 'Mois', key: 'month', width: 10 }, { header: 'Facturé', key: 'invoiced', width: 14, money: true },
      { header: 'Espèces', key: 'CASH', width: 12, money: true }, { header: 'Carte', key: 'CARD', width: 12, money: true },
      { header: 'Virement', key: 'TRANSFER', width: 12, money: true }, { header: 'Chèque', key: 'CHECK', width: 12, money: true },
      { header: 'Total encaissé', key: 'total', width: 15, money: true },
    ], monthKeys.map(m => {
      const r = months.get(m) || { CASH: 0, CARD: 0, TRANSFER: 0, CHECK: 0 };
      return { month: m, invoiced: invoiced.get(m) || 0, ...r, total: Object.values(r).reduce((a, b) => a + b, 0) };
    }));
    const totalRow = summary.addRow({
      month: 'Total', invoiced: monthKeys.reduce((s, m) => s + (invoiced.get(m) || 0), 0),
      ...['CASH', 'CARD', 'TRANSFER', 'CHECK'].reduce((o, k) => ({ ...o, [k]: monthKeys.reduce((s, m) => s + (months.get(m)?.[k] || 0), 0) }), {}),
      total: payments.reduce((s, p) => s + toNumber(p.amount), 0),
    });
    totalRow.font = { bold: true };

    sheet('Clôtures de caisse', [
      { header: 'Jour', key: 'day', width: 12, date: true }, { header: 'Espèces attendues', key: 'expected', width: 18, money: true },
      { header: 'Espèces comptées', key: 'counted', width: 18, money: true }, { header: 'Écart', key: 'difference', width: 12, money: true },
      { header: 'Clôturée par', key: 'by', width: 20 }, { header: 'Note', key: 'notes', width: 30 },
    ], closings.map(c => ({ day: c.day, expected: toNumber(c.expectedCash), counted: toNumber(c.countedCash), difference: toNumber(c.difference), by: who(c.closedById), notes: c.notes || '' })));

    const safeName = cabinet.name.normalize('NFD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'cabinet';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="comptabilite-${safeName}-${q.from}-au-${q.to}.xlsx"`);
    res.send(Buffer.from(await wb.xlsx.writeBuffer()));
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

/**
 * Bill and collect in one step (end of visit, "Encaisser" from the day screen):
 * creates an invoice from the given lines (optional), then spreads the amount received over what the patient owes,
 * the new invoice first, then the oldest open invoices. One payment per invoice touched, all in one transaction.
 * amount 0 = bill only (paid later).
 */
billing.post('/charge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      patientId: z.string().min(1),
      items: z.array(itemInput).default([]),
      amount: z.number().min(0).default(0),
      method: z.enum(PAYMENT_METHODS).default('CASH'),
      reference: z.string().nullable().optional(),
      includeOpen: z.boolean().default(true),
    }).refine(v => v.items.length > 0 || v.amount > 0, 'Rien à facturer ni à encaisser').parse(req.body);
    await findPatientOr404(req, data.patientId);
    const ownOnly = req.user!.role === 'PRACTITIONER';

    const result = await prisma.$transaction(async (tx) => {
      let invoiceId: string | null = null;
      if (data.items.length) {
        const created = await tx.invoice.create({
          data: {
            cabinetId: req.params.cabinetId, patientId: data.patientId,
            practitionerId: req.user!.role === 'ASSISTANT' || req.user!.role === 'SUPER_ADMIN' ? null : req.user!.id,
            number: await nextNumber(tx, req.params.cabinetId, 'invoice'),
            items: { create: data.items.map(item => ({ ...item, total: lineTotal(item.unitPrice, item.quantity) })) },
          },
        });
        await recomputeInvoice(tx, created.id);
        invoiceId = created.id;
      }
      const open = await tx.invoice.findMany({
        where: {
          cabinetId: req.params.cabinetId, patientId: data.patientId, status: { in: ['OPEN', 'PARTIAL'] },
          ...(ownOnly ? { practitionerId: req.user!.id } : {}),
          ...(data.includeOpen ? {} : { id: invoiceId ?? '' }),
        },
        orderBy: { date: 'asc' },
      });
      // New invoice first, then the oldest debts.
      const queue = [...open.filter(i => i.id === invoiceId), ...open.filter(i => i.id !== invoiceId)];
      const due = queue.reduce((s, i) => s + toNumber(i.total) - toNumber(i.paid), 0);
      if (data.amount > due + 0.001) throw new AppError(`Le montant dépasse le reste à payer (${due.toFixed(2)})`, 400);
      let left = data.amount;
      const payments = [];
      for (const invoice of queue) {
        if (left <= 0.001) break;
        const pay = Math.min(left, toNumber(invoice.total) - toNumber(invoice.paid));
        if (pay <= 0) continue;
        payments.push(await tx.payment.create({ data: { cabinetId: req.params.cabinetId, patientId: data.patientId, invoiceId: invoice.id, method: data.method, amount: Math.round(pay * 100) / 100, reference: data.reference || null, receivedById: req.user!.id } }));
        await recomputeInvoice(tx, invoice.id);
        left -= pay;
      }
      return { invoiceId, payments: payments.length, paid: data.amount, remaining: Math.round((due - data.amount) * 100) / 100 };
    });
    sendSuccess(res, result, result.paid > 0 ? 'Paiement enregistré' : 'Facture créée', undefined, 201);
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
