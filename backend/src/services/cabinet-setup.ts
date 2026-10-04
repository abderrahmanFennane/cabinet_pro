import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error';

type Tx = Prisma.TransactionClient;

/** Short prefix of each specialty, used when two specialties of the same cabinet share an act code (CONS, CTRL…). */
export const SPECIALTY_PREFIX: Record<string, string> = {
  DENTISTRY: 'DEN', GENERAL: 'MG', PEDIATRICS: 'PED', GYNECOLOGY: 'GYN', OPHTHALMOLOGY: 'OPH',
  CARDIOLOGY: 'CAR', DERMATOLOGY: 'DER', PHYSIOTHERAPY: 'KIN', PSYCHIATRY: 'PSY',
};

/**
 * Copies the Super Admin's default act catalogue of a specialty into a cabinet, skipping the acts it already has
 * (same specialty and same code, prefixed code or same name). Acts of a specialty other than the cabinet's main one
 * get the specialty prefix (e.g. CAR-CONS), so codes shared by specialties (CONS, CTRL…) never clash. Prices already set are never changed.
 */
export async function copyDefaultActs(tx: Tx, cabinetId: string, specialty: string) {
  const defaults = await tx.defaultAct.findMany({ where: { specialty, isActive: true } });
  if (!defaults.length) return 0;
  const existing = await tx.act.findMany({ where: { cabinetId, deletedAt: null }, select: { code: true, name: true, specialty: true } });
  const codes = new Set(existing.map(a => a.code));
  const prefix = SPECIALTY_PREFIX[specialty] || specialty.slice(0, 3);
  // The cabinet's main specialty keeps the plain codes; any other specialty is always prefixed, so codes stay consistent.
  const cabinet = await tx.cabinet.findUnique({ where: { id: cabinetId }, select: { specialty: true } });
  const main = !cabinet || cabinet.specialty === specialty;
  const mine = existing.filter(a => a.specialty === specialty);
  const rows = [];
  for (const d of defaults) {
    const prefixed = `${prefix}-${d.code}`;
    if (mine.some(a => a.code === d.code || a.code === prefixed || a.name.toLowerCase() === d.name.toLowerCase())) continue;
    const code = main && !codes.has(d.code) ? d.code : prefixed;
    if (codes.has(code)) continue;
    codes.add(code);
    rows.push({
      cabinetId, specialty: d.specialty, code, name: d.name, price: d.price, category: d.category,
      scope: d.scope, usesFaces: d.usesFaces, resultingState: d.resultingState,
    });
  }
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
