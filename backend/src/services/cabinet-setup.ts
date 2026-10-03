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
  const cabinet = await tx.cabinet.findUnique({ where: { id: cabinetId }, select: { plan: true, maxPractitioners: true, maxAssistants: true, deletedAt: true } });
  if (!cabinet || cabinet.deletedAt) throw new AppError('Cabinet introuvable', 404);
  const isPractitioner = role === 'OWNER' || role === 'PRACTITIONER';
  const used = await tx.user.count({ where: { cabinetId, deletedAt: null, role: isPractitioner ? { in: ['OWNER', 'PRACTITIONER'] } : 'ASSISTANT' } });
  const limit = isPractitioner ? cabinet.maxPractitioners : cabinet.maxAssistants;
  if (used >= limit) {
    const what = isPractitioner ? `${limit} médecin${limit > 1 ? 's' : ''}` : `${limit} assistant${limit > 1 ? 's' : ''}`;
    const plan = await tx.plan.findUnique({ where: { code: cabinet.plan }, select: { name: true } });
    throw new AppError(`Le plan ${plan?.name || cabinet.plan} de ce cabinet permet ${what}, déjà atteint. Passez à un plan supérieur (Abonnement) pour en ajouter.`, 409);
  }
}

const SPECIALTY_NAMES: Record<string, string> = {
  DENTISTRY: 'Médecine dentaire', GENERAL: 'Médecine générale', PEDIATRICS: 'Pédiatrie', GYNECOLOGY: 'Gynécologie-obstétrique',
  OPHTHALMOLOGY: 'Ophtalmologie', CARDIOLOGY: 'Cardiologie', DERMATOLOGY: 'Dermatologie', PHYSIOTHERAPY: 'Kinésithérapie',
  PSYCHIATRY: 'Psychiatrie / psychologie',
};

/**
 * Adds the specialties and default acts the code knows about but the database does not have yet
 * (e.g. after an update that brings a new specialty module). Never changes what the Super Admin edited:
 * existing prices, names and "offered" choices stay as they are.
 */
export async function ensureCatalogue(db: { specialty: any; defaultAct: any }) {
  const { ACTS_BY_SPECIALTY } = await import('../data/catalogue');
  const specialties = await db.specialty.createMany({
    data: Object.entries(SPECIALTY_NAMES).map(([code, name], i) => ({ code, name, isActive: true, sortOrder: i + 1 })),
    skipDuplicates: true,
  });
  const acts = await db.defaultAct.createMany({
    data: Object.entries(ACTS_BY_SPECIALTY).flatMap(([specialty, list]) => list.map(a => ({
      specialty, code: a.code, name: a.name, price: a.price, category: a.category, scope: a.scope, usesFaces: !!a.usesFaces, resultingState: a.resultingState || null,
    }))),
    skipDuplicates: true,
  });
  return { specialties: specialties.count as number, acts: acts.count as number };
}
