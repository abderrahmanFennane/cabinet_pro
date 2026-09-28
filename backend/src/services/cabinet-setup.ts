import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error';

type Tx = Prisma.TransactionClient;

/** Copies the Super Admin's default act catalogue of a specialty into a cabinet (skips codes it already has). */
export async function copyDefaultActs(tx: Tx, cabinetId: string, specialty: string) {
  const defaults = await tx.defaultAct.findMany({ where: { specialty, isActive: true } });
  if (!defaults.length) return 0;
  const existing = await tx.act.findMany({ where: { cabinetId }, select: { code: true } });
  const known = new Set(existing.map(a => a.code));
  const rows = defaults.filter(d => !known.has(d.code)).map(d => ({
    cabinetId, specialty: d.specialty, code: d.code, name: d.name, price: d.price, category: d.category,
    scope: d.scope, usesFaces: d.usesFaces, resultingState: d.resultingState,
  }));
  if (rows.length) await tx.act.createMany({ data: rows });
  return rows.length;
}

/** Applies a plan's quotas to a cabinet. */
export function planQuotas(plan: { maxPractitioners: number; maxAssistants: number; monthlyMessages: number }) {
  return { maxPractitioners: plan.maxPractitioners, maxAssistants: plan.maxAssistants, monthlyMessages: plan.monthlyMessages };
}

/** Throws when adding a user of this role would exceed the cabinet's plan quota. */
export async function assertSeatAvailable(tx: Tx, cabinetId: string, role: string) {
  const cabinet = await tx.cabinet.findUnique({ where: { id: cabinetId }, select: { maxPractitioners: true, maxAssistants: true, deletedAt: true } });
  if (!cabinet || cabinet.deletedAt) throw new AppError('Cabinet introuvable', 404);
  const isPractitioner = role === 'OWNER' || role === 'PRACTITIONER';
  const used = await tx.user.count({ where: { cabinetId, deletedAt: null, role: isPractitioner ? { in: ['OWNER', 'PRACTITIONER'] } : 'ASSISTANT' } });
  const limit = isPractitioner ? cabinet.maxPractitioners : cabinet.maxAssistants;
  if (used >= limit) {
    throw new AppError(`Quota atteint pour votre plan : ${limit} ${isPractitioner ? 'praticien(s)' : 'assistant(s)'}`, 409);
  }
}
