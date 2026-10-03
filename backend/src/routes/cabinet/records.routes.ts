import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireMedicalAccess, requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { findPatientOr404, logPatientAccess } from '../../utils/patient-scope';
import { isPrivateKind, RECORD_KINDS, RECORD_KIND_KEYS, RecordKind } from '../../data/specialty-modules';

// Specialty modules' records. Mounted at /api/cabinets/:cabinetId/patients/:patientId/records
const router = Router({ mergeParams: true });
router.use(requireMedicalAccess);

const practitionerSelect = { select: { id: true, firstName: true, lastName: true, title: true, specialty: true } };
const kindEnum = z.enum(RECORD_KIND_KEYS as [RecordKind, ...RecordKind[]]);

// Private notes (psychotherapy) are visible to their author only.
const visibleTo = (req: Request) => ({ OR: [{ private: false }, { practitionerId: req.user!.id }] });

const serialize = (record: any) => ({ ...record, data: JSON.parse(record.data || '{}') });

function parseData(kind: RecordKind, data: unknown) {
  const result = RECORD_KINDS[kind].schema.safeParse(data ?? {});
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AppError(`Donnée invalide (${first.path.join('.') || kind}) : ${first.message}`, 400);
  }
  return result.data;
}

/** Records of one patient, filtered by specialty and/or kind, newest first. */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ specialty: z.string().optional(), kind: kindEnum.optional() }).parse(req.query);
    const patient = await findPatientOr404(req);
    const records = await prisma.clinicalRecord.findMany({
      where: { patientId: patient.id, deletedAt: null, ...(q.specialty ? { specialty: q.specialty } : {}), ...(q.kind ? { kind: q.kind } : {}), ...visibleTo(req) },
      include: { practitioner: practitionerSelect },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    await logPatientAccess(req, patient.id, 'VIEW_MEDICAL', q.specialty ? `module ${q.specialty}` : 'modules de spécialité');
    sendSuccess(res, records.map(serialize));
  } catch (err) { next(err); }
});

router.post('/', requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ kind: kindEnum, date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(), data: z.unknown() }).parse(req.body);
    const patient = await findPatientOr404(req);
    const data = parseData(body.kind, body.data);
    const record = await prisma.clinicalRecord.create({
      data: {
        cabinetId: req.params.cabinetId, patientId: patient.id, practitionerId: req.user!.id,
        specialty: RECORD_KINDS[body.kind].specialty, kind: body.kind, private: isPrivateKind(body.kind),
        date: body.date ? new Date(body.date) : new Date(), data: JSON.stringify(data),
      },
      include: { practitioner: practitionerSelect },
    });
    sendSuccess(res, serialize(record), 'Enregistré', undefined, 201);
  } catch (err) { next(err); }
});

async function findOwnRecord(req: Request) {
  const patient = await findPatientOr404(req);
  const record = await prisma.clinicalRecord.findFirst({ where: { id: req.params.id, patientId: patient.id, deletedAt: null, ...visibleTo(req) } });
  if (!record) throw new AppError('Élément introuvable', 404);
  // A colleague's private note can never be changed; other records can be corrected by the cabinet's doctors.
  if (record.private && record.practitionerId !== req.user!.id) throw new AppError('Accès non autorisé', 403);
  return record;
}

router.patch('/:id', requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await findOwnRecord(req);
    const body = z.object({ date: z.string().optional(), data: z.unknown() }).parse(req.body);
    const data = parseData(record.kind as RecordKind, body.data);
    const updated = await prisma.clinicalRecord.update({
      where: { id: record.id },
      data: { data: JSON.stringify(data), ...(body.date ? { date: new Date(body.date) } : {}) },
      include: { practitioner: practitionerSelect },
    });
    sendSuccess(res, serialize(updated), 'Modifié');
  } catch (err) { next(err); }
});

router.delete('/:id', requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await findOwnRecord(req);
    await prisma.clinicalRecord.update({ where: { id: record.id }, data: { deletedAt: new Date() } });
    sendSuccess(res, null, 'Supprimé');
  } catch (err) { next(err); }
});

export default router;
