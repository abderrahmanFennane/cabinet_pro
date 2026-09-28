import { Prisma } from '@prisma/client';
import { nextNumber, toNumber } from './patient-scope';

type Tx = Prisma.TransactionClient;

/** Recomputes total, paid and status of an invoice from its items and payments. */
export async function recomputeInvoice(tx: Tx, invoiceId: string) {
  const [items, payments, invoice] = await Promise.all([
    tx.invoiceItem.aggregate({ where: { invoiceId }, _sum: { total: true } }),
    tx.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
    tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { status: true } }),
  ]);
  const total = toNumber(items._sum.total);
  const paid = toNumber(payments._sum.amount);
  const status = invoice.status === 'CANCELLED' ? 'CANCELLED' : paid <= 0 ? 'OPEN' : paid + 0.001 >= total ? 'PAID' : 'PARTIAL';
  return tx.invoice.update({ where: { id: invoiceId }, data: { total, paid, status } });
}

/** Today's open invoice of the patient, created when missing: the day's acts are billed together. */
export async function openInvoiceForToday(tx: Tx, cabinetId: string, patientId: string, practitionerId?: string | null) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const existing = await tx.invoice.findFirst({
    where: { cabinetId, patientId, date: { gte: start }, status: { in: ['OPEN', 'PARTIAL'] } },
    orderBy: { date: 'desc' },
  });
  if (existing) return existing;
  return tx.invoice.create({ data: { cabinetId, patientId, practitionerId: practitionerId || null, number: await nextNumber(tx, cabinetId, 'invoice') } });
}

/** Paid amount and remaining balance of a quote. */
export async function quoteBalance(tx: Tx, quoteId: string) {
  const [quote, payments] = await Promise.all([
    tx.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { total: true } }),
    tx.payment.aggregate({ where: { quoteId }, _sum: { amount: true } }),
  ]);
  const total = toNumber(quote.total);
  const paid = toNumber(payments._sum.amount);
  return { total, paid, remaining: Math.max(0, Math.round((total - paid) * 100) / 100) };
}

export function lineTotal(unitPrice: number, quantity: number) {
  return Math.round(unitPrice * quantity * 100) / 100;
}
