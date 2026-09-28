import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error';

/**
 * Patients visible to the current user. A collaborator (PRACTITIONER) sees only the patients
 * they follow, unless the owner allowed them to see the whole cabinet.
 */
export function patientWhere(req: Request): Prisma.PatientWhereInput {
  const base: Prisma.PatientWhereInput = { cabinetId: req.params.cabinetId, deletedAt: null };
  const user = req.user!;
  if (user.role === 'PRACTITIONER' && !user.seesAllPatients) {
    return {
      ...base,
      OR: [
        { primaryPractitionerId: user.id },
        { appointments: { some: { practitionerId: user.id } } },
        { consultations: { some: { practitionerId: user.id } } },
        { dentalActs: { some: { practitionerId: user.id } } },
      ],
    };
  }
  return base;
}

/** Loads a patient the current user may see, or throws 404. */
export async function findPatientOr404(req: Request, patientId = req.params.patientId) {
  const patient = await prisma.patient.findFirst({ where: { ...patientWhere(req), id: patientId } });
  if (!patient) throw new AppError('Patient introuvable', 404);
  return patient;
}

export type AccessAction = 'VIEW_RECORD' | 'VIEW_MEDICAL' | 'DENIED' | 'SUPPORT_VIEW';

export async function logPatientAccess(req: Request, patientId: string, action: AccessAction, detail?: string) {
  const cabinetId = req.params.cabinetId;
  if (!req.user || !cabinetId) return;
  const effective: AccessAction = req.user.role === 'SUPER_ADMIN' && action !== 'DENIED' ? 'SUPPORT_VIEW' : action;
  await prisma.patientAccessLog.create({
    data: { cabinetId, patientId, userId: req.user.id, action: effective, detail: detail?.slice(0, 190) },
  }).catch(() => undefined);
}

export const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => Number(value ?? 0);

/** Next document number for the cabinet, e.g. F-2026-00012 / D-2026-00003. */
export async function nextNumber(tx: Prisma.TransactionClient, cabinetId: string, kind: 'invoice' | 'quote') {
  const field = kind === 'invoice' ? 'invoiceSeq' : 'quoteSeq';
  const cabinet = await tx.cabinet.update({ where: { id: cabinetId }, data: { [field]: { increment: 1 } }, select: { invoiceSeq: true, quoteSeq: true } });
  const seq = kind === 'invoice' ? cabinet.invoiceSeq : cabinet.quoteSeq;
  return `${kind === 'invoice' ? 'F' : 'D'}-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
}
