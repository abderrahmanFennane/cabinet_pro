import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireMedicalAccess, requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { findPatientOr404, logPatientAccess } from '../../utils/patient-scope';

// Mounted at /api/cabinets/:cabinetId/patients/:patientId
const router = Router({ mergeParams: true });

const practitionerSelect = { select: { id: true, firstName: true, lastName: true, title: true, specialty: true } };

const vitalsSchema = z.object({
  systolic: z.number().optional(), diastolic: z.number().optional(), pulse: z.number().optional(),
  weight: z.number().optional(), height: z.number().optional(), temperature: z.number().optional(),
  glucose: z.number().optional(), spo2: z.number().optional(),
}).partial().nullable().optional();

const consultationSchema = z.object({
  appointmentId: z.string().nullable().optional(),
  date: z.string().datetime().optional(),
  reason: z.string().nullable().optional(),
  examination: z.string().nullable().optional(),
  vitals: vitalsSchema,
  diagnosis: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const parseJson = (value: string | null) => {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
};

const serializeConsultation = (c: any) => ({ ...c, vitals: parseJson(c.vitals) });

const canEdit = (req: Request, authorId: string) => req.user!.role === 'OWNER' || req.user!.id === authorId || !!req.user!.support;

// ─── Consultations (F-CST) ───

router.get('/consultations', requireMedicalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const items = await prisma.consultation.findMany({ where: { patientId: patient.id }, include: { practitioner: practitionerSelect, revisions: { select: { id: true, version: true, createdAt: true, authorId: true, reason: true } } }, orderBy: { date: 'desc' } });
    sendSuccess(res, items.map(serializeConsultation));
  } catch (err) { next(err); }
});

router.get('/consultations/:id', requireMedicalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const consultation = await prisma.consultation.findFirst({ where: { id: req.params.id, patientId: patient.id }, include: { practitioner: practitionerSelect, revisions: { orderBy: { version: 'desc' } } } });
    if (!consultation) throw new AppError('Consultation introuvable', 404);
    await logPatientAccess(req, patient.id, 'VIEW_MEDICAL', `consultation ${consultation.id}`);
    sendSuccess(res, { ...serializeConsultation(consultation), revisions: consultation.revisions.map(r => ({ ...r, content: parseJson(r.content) })) });
  } catch (err) { next(err); }
});

router.post('/consultations', requireMedicalAccess, requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const data = consultationSchema.parse(req.body);
    if (data.appointmentId) {
      const appointment = await prisma.appointment.findFirst({ where: { id: data.appointmentId, patientId: patient.id, cabinetId: req.params.cabinetId } });
      if (!appointment) throw new AppError('Rendez-vous introuvable', 400);
      if (['PLANNED', 'CONFIRMED', 'ARRIVED'].includes(appointment.status)) {
        await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'IN_CONSULTATION', startedAt: new Date() } });
      }
    }
    const consultation = await prisma.consultation.create({
      data: {
        ...data,
        date: data.date ? new Date(data.date) : new Date(),
        vitals: data.vitals ? JSON.stringify(data.vitals) : null,
        cabinetId: req.params.cabinetId,
        patientId: patient.id,
        practitionerId: req.user!.id,
        specialty: req.user!.specialty || 'GENERAL',
      },
      include: { practitioner: practitionerSelect },
    });
    sendSuccess(res, serializeConsultation(consultation), 'Consultation créée', undefined, 201);
  } catch (err) { next(err); }
});

/** A draft is edited in place. A locked consultation keeps a dated, signed snapshot of each prior version (F-CST-04). */
router.patch('/consultations/:id', requireMedicalAccess, requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const existing = await prisma.consultation.findFirst({ where: { id: req.params.id, patientId: patient.id } });
    if (!existing) throw new AppError('Consultation introuvable', 404);
    if (!canEdit(req, existing.practitionerId)) throw new AppError('Seul l’auteur ou le titulaire peut modifier cette consultation', 403);
    const { correctionReason, ...rest } = consultationSchema.extend({ correctionReason: z.string().trim().min(3).optional() }).parse(req.body);
    const data: any = { ...rest, vitals: rest.vitals === undefined ? undefined : rest.vitals ? JSON.stringify(rest.vitals) : null, date: rest.date ? new Date(rest.date) : undefined };

    const consultation = await prisma.$transaction(async (tx) => {
      if (existing.status === 'LOCKED') {
        if (!correctionReason) throw new AppError('Motif de correction requis pour une consultation verrouillée', 400);
        const { id: _id, revisions: _r, ...snapshot } = existing as any;
        await tx.consultationRevision.create({ data: { consultationId: existing.id, version: existing.version, content: JSON.stringify(snapshot), authorId: req.user!.id, reason: correctionReason } });
        data.version = existing.version + 1;
        data.lockedAt = new Date();
      }
      return tx.consultation.update({ where: { id: existing.id }, data, include: { practitioner: practitionerSelect } });
    });
    sendSuccess(res, serializeConsultation(consultation), existing.status === 'LOCKED' ? 'Correction enregistrée (nouvelle version)' : 'Consultation enregistrée');
  } catch (err) { next(err); }
});

/** Ends the consultation: it is locked and the appointment is marked done. */
router.post('/consultations/:id/lock', requireMedicalAccess, requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const existing = await prisma.consultation.findFirst({ where: { id: req.params.id, patientId: patient.id } });
    if (!existing) throw new AppError('Consultation introuvable', 404);
    if (!canEdit(req, existing.practitionerId)) throw new AppError('Seul l’auteur ou le titulaire peut terminer cette consultation', 403);
    const consultation = await prisma.consultation.update({ where: { id: existing.id }, data: { status: 'LOCKED', lockedAt: new Date() }, include: { practitioner: practitionerSelect } });
    if (existing.appointmentId) {
      await prisma.appointment.updateMany({ where: { id: existing.appointmentId, status: { notIn: ['CANCELLED', 'NO_SHOW'] } }, data: { status: 'DONE', completedAt: new Date() } });
    }
    sendSuccess(res, serializeConsultation(consultation), 'Consultation terminée et verrouillée');
  } catch (err) { next(err); }
});

// ─── Prescriptions (F-DOC-01, F-DOC-02) ───

const prescriptionItem = z.object({
  drug: z.string().trim().min(1, 'Médicament requis'),
  dosage: z.string().trim().nullable().optional(),
  duration: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});
const prescriptionSchema = z.object({
  consultationId: z.string().nullable().optional(),
  items: z.array(prescriptionItem).min(1, 'Ajoutez au moins un médicament'),
  notes: z.string().nullable().optional(),
});

const serializePrescription = (p: any) => ({ ...p, items: parseJson(p.items) || [] });

// Assistants may list and print prescriptions (rights matrix: "Imprimer"), not write them.
const canReadPrescriptions = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.permissions?.includes('PRINT_DOCUMENTS')) return next();
  return requireMedicalAccess(req, res, next);
};

router.get('/prescriptions', canReadPrescriptions, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const items = await prisma.prescription.findMany({ where: { patientId: patient.id }, include: { practitioner: practitionerSelect }, orderBy: { date: 'desc' } });
    sendSuccess(res, items.map(serializePrescription));
  } catch (err) { next(err); }
});

router.get('/prescriptions/:id', canReadPrescriptions, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const prescription = await prisma.prescription.findFirst({ where: { id: req.params.id, patientId: patient.id }, include: { practitioner: practitionerSelect } });
    if (!prescription) throw new AppError('Ordonnance introuvable', 404);
    sendSuccess(res, serializePrescription(prescription));
  } catch (err) { next(err); }
});

router.post('/prescriptions', requireMedicalAccess, requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const data = prescriptionSchema.parse(req.body);
    const prescription = await prisma.prescription.create({
      data: { cabinetId: req.params.cabinetId, patientId: patient.id, practitionerId: req.user!.id, consultationId: data.consultationId, notes: data.notes, items: JSON.stringify(data.items) },
      include: { practitioner: practitionerSelect },
    });
    sendSuccess(res, serializePrescription(prescription), 'Ordonnance créée', undefined, 201);
  } catch (err) { next(err); }
});

/** One-click renewal: same items, today's date, signed by the current practitioner. */
router.post('/prescriptions/:id/renew', requireMedicalAccess, requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const source = await prisma.prescription.findFirst({ where: { id: req.params.id, patientId: patient.id } });
    if (!source) throw new AppError('Ordonnance introuvable', 404);
    const prescription = await prisma.prescription.create({
      data: { cabinetId: req.params.cabinetId, patientId: patient.id, practitionerId: req.user!.id, items: source.items, notes: source.notes },
      include: { practitioner: practitionerSelect },
    });
    sendSuccess(res, serializePrescription(prescription), 'Ordonnance renouvelée', undefined, 201);
  } catch (err) { next(err); }
});

// ─── Certificates, sick leave, referral letters, exam requests (F-DOC-03) ───

const DOCUMENT_TYPES = ['CERTIFICATE', 'SICK_LEAVE', 'REFERRAL', 'EXAM_REQUEST', 'OTHER'] as const;

router.get('/documents', canReadPrescriptions, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    sendSuccess(res, await prisma.medicalDocument.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' } }));
  } catch (err) { next(err); }
});

router.get('/documents/:id', canReadPrescriptions, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const document = await prisma.medicalDocument.findFirst({ where: { id: req.params.id, patientId: patient.id } });
    if (!document) throw new AppError('Document introuvable', 404);
    const practitioner = await prisma.user.findUnique({ where: { id: document.practitionerId }, select: { id: true, firstName: true, lastName: true, title: true, specialty: true } });
    sendSuccess(res, { ...document, practitioner });
  } catch (err) { next(err); }
});

router.post('/documents', requireMedicalAccess, requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const data = z.object({ type: z.enum(DOCUMENT_TYPES), title: z.string().trim().min(1), body: z.string().trim().min(1) }).parse(req.body);
    const document = await prisma.medicalDocument.create({ data: { ...data, cabinetId: req.params.cabinetId, patientId: patient.id, practitionerId: req.user!.id } });
    sendSuccess(res, document, 'Document créé', undefined, 201);
  } catch (err) { next(err); }
});

export default router;
