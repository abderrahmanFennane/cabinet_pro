import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { ageInYears, dentitionForAge } from '../../utils/dental';
import { findPatientOr404, logPatientAccess, patientWhere, toNumber } from '../../utils/patient-scope';

const router = Router({ mergeParams: true });

const optionalDate = z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).nullable().optional()
  .transform(value => (value ? new Date(value) : value === null ? null : undefined));

const adminFields = {
  firstName: z.string().trim().min(1, 'Prénom requis'),
  lastName: z.string().trim().min(1, 'Nom requis'),
  sex: z.enum(['F', 'M']).nullable().optional(),
  birthDate: optionalDate,
  cin: z.string().trim().max(20).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email('Email invalide').nullable().optional().or(z.literal('').transform(() => null)),
  address: z.string().trim().max(255).nullable().optional(),
  coverage: z.enum(['AMO', 'CNOPS', 'MUTUELLE', 'NONE']).optional(),
  coverageNumber: z.string().trim().max(50).nullable().optional(),
  primaryPractitionerId: z.string().nullable().optional(),
  consentData: z.boolean().optional(),
  consentReminders: z.boolean().optional(),
  notes: z.string().nullable().optional(),
};

const medicalFields = {
  bloodGroup: z.string().trim().max(5).nullable().optional(),
  medicalHistory: z.string().nullable().optional(),
  surgicalHistory: z.string().nullable().optional(),
  familyHistory: z.string().nullable().optional(),
  currentTreatments: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
  dentition: z.enum(['PRIMARY', 'MIXED', 'PERMANENT']).nullable().optional(),
};

const createSchema = z.object({ ...adminFields, ...medicalFields });
const updateSchema = z.object({ ...adminFields, ...medicalFields }).partial();
const MEDICAL_KEYS = Object.keys(medicalFields);

const canSeeMedical = (req: Request) => !!req.user?.permissions?.includes('VIEW_MEDICAL');

function serialize(patient: any, withMedical: boolean) {
  const age = patient.birthDate ? ageInYears(patient.birthDate) : null;
  const base = {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    sex: patient.sex,
    birthDate: patient.birthDate,
    age,
    cin: patient.cin,
    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    coverage: patient.coverage,
    coverageNumber: patient.coverageNumber,
    primaryPractitionerId: patient.primaryPractitionerId,
    consentDataAt: patient.consentDataAt,
    consentRemindersAt: patient.consentRemindersAt,
    notes: patient.notes,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
  if (!withMedical) return base;
  return {
    ...base,
    bloodGroup: patient.bloodGroup,
    medicalHistory: patient.medicalHistory,
    surgicalHistory: patient.surgicalHistory,
    familyHistory: patient.familyHistory,
    currentTreatments: patient.currentTreatments,
    allergies: patient.allergies,
    dentition: patient.dentition,
    autoDentition: dentitionForAge(patient.birthDate),
  };
}

function toData(req: Request, input: z.infer<typeof updateSchema>) {
  const { consentData, consentReminders, ...rest } = input;
  if (!canSeeMedical(req) && MEDICAL_KEYS.some(key => (rest as any)[key] !== undefined)) {
    throw new AppError('Les informations médicales sont réservées aux praticiens', 403);
  }
  const data: any = { ...rest };
  if (consentData !== undefined) data.consentDataAt = consentData ? new Date() : null;
  if (consentReminders !== undefined) data.consentRemindersAt = consentReminders ? new Date() : null;
  return data;
}

async function assertPractitioner(cabinetId: string, userId: string | null | undefined) {
  if (!userId) return;
  const practitioner = await prisma.user.findFirst({ where: { id: userId, cabinetId, role: { in: ['OWNER', 'PRACTITIONER'] }, deletedAt: null } });
  if (!practitioner) throw new AppError('Praticien introuvable', 400);
}

router.get('/', requirePermissions('MANAGE_PATIENTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({
      search: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }).parse(req.query);
    const where: any = { AND: [patientWhere(req)] };
    if (q.search) {
      const terms = q.search.split(/\s+/).filter(Boolean);
      for (const term of terms) {
        where.AND.push({ OR: [{ firstName: { contains: term } }, { lastName: { contains: term } }, { phone: { contains: term } }, { cin: { contains: term } }] });
      }
    }
    const [items, total] = await Promise.all([
      prisma.patient.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit }),
      prisma.patient.count({ where }),
    ]);
    sendSuccess(res, items.map(p => serialize(p, false)), undefined, { total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) });
  } catch (err) { next(err); }
});

/** F-PAT-03: possible duplicates before creating a patient. */
router.get('/duplicates', requirePermissions('MANAGE_PATIENTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ firstName: z.string().optional(), lastName: z.string().optional(), phone: z.string().optional(), cin: z.string().optional() }).parse(req.query);
    const or: any[] = [];
    if (q.cin?.trim()) or.push({ cin: q.cin.trim() });
    if (q.phone?.trim() && q.phone.replace(/\D/g, '').length >= 6) or.push({ phone: { contains: q.phone.replace(/\D/g, '').slice(-8) } });
    if (q.firstName?.trim() && q.lastName?.trim()) or.push({ firstName: q.firstName.trim(), lastName: q.lastName.trim() });
    if (!or.length) return sendSuccess(res, []);
    const items = await prisma.patient.findMany({ where: { cabinetId: req.params.cabinetId, deletedAt: null, OR: or }, take: 5 });
    sendSuccess(res, items.map(p => serialize(p, false)));
  } catch (err) { next(err); }
});

router.post('/', requirePermissions('MANAGE_PATIENTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createSchema.parse(req.body);
    await assertPractitioner(req.params.cabinetId, input.primaryPractitionerId);
    const data = toData(req, input);
    if (!data.primaryPractitionerId && req.user?.role !== 'ASSISTANT' && req.user?.role !== 'SUPER_ADMIN') data.primaryPractitionerId = req.user!.id;
    const patient = await prisma.patient.create({ data: { ...data, cabinetId: req.params.cabinetId } });
    sendSuccess(res, serialize(patient, canSeeMedical(req)), 'Patient créé', undefined, 201);
  } catch (err) { next(err); }
});

router.get('/:patientId', requirePermissions('MANAGE_PATIENTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const withMedical = canSeeMedical(req);
    await logPatientAccess(req, patient.id, withMedical ? 'VIEW_MEDICAL' : 'VIEW_RECORD');
    const [balance, nextAppointment] = await Promise.all([
      prisma.invoice.aggregate({ where: { patientId: patient.id, status: { not: 'CANCELLED' } }, _sum: { total: true, paid: true } }),
      prisma.appointment.findFirst({ where: { patientId: patient.id, deletedAt: null, date: { gte: new Date() }, status: { in: ['PLANNED', 'CONFIRMED'] } }, orderBy: { date: 'asc' }, include: { practitioner: { select: { id: true, firstName: true, lastName: true, title: true } } } }),
    ]);
    sendSuccess(res, {
      ...serialize(patient, withMedical),
      balanceDue: toNumber(balance._sum.total) - toNumber(balance._sum.paid),
      nextAppointment,
    });
  } catch (err) { next(err); }
});

router.patch('/:patientId', requirePermissions('MANAGE_PATIENTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await findPatientOr404(req);
    const input = updateSchema.parse(req.body);
    await assertPractitioner(req.params.cabinetId, input.primaryPractitionerId);
    const patient = await prisma.patient.update({ where: { id: req.params.patientId }, data: toData(req, input) });
    sendSuccess(res, serialize(patient, canSeeMedical(req)), 'Patient mis à jour');
  } catch (err) { next(err); }
});

router.delete('/:patientId', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await findPatientOr404(req);
    await prisma.patient.update({ where: { id: req.params.patientId }, data: { deletedAt: new Date() } });
    sendSuccess(res, null, 'Patient archivé');
  } catch (err) { next(err); }
});

/** F-PAT-04: one timeline of appointments, consultations, acts, prescriptions, documents and payments. */
router.get('/:patientId/timeline', requirePermissions('MANAGE_PATIENTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const medical = canSeeMedical(req);
    const canPrint = !!req.user?.permissions?.includes('PRINT_DOCUMENTS');
    const practitioner = { select: { id: true, firstName: true, lastName: true, title: true } };
    const [appointments, consultations, acts, prescriptions, documents, attachments, payments, invoices] = await Promise.all([
      prisma.appointment.findMany({ where: { patientId: patient.id, deletedAt: null }, include: { practitioner: practitioner }, orderBy: { date: 'desc' }, take: 100 }),
      medical ? prisma.consultation.findMany({ where: { patientId: patient.id }, include: { practitioner: practitioner }, orderBy: { date: 'desc' }, take: 100 }) : [],
      medical ? prisma.dentalAct.findMany({ where: { patientId: patient.id, status: 'DONE' }, include: { practitioner: practitioner }, orderBy: { performedAt: 'desc' }, take: 200 }) : [],
      medical || canPrint ? prisma.prescription.findMany({ where: { patientId: patient.id }, include: { practitioner: practitioner }, orderBy: { date: 'desc' }, take: 100 }) : [],
      medical || canPrint ? prisma.medicalDocument.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' }, take: 100 }) : [],
      medical ? prisma.attachment.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' }, take: 100 }) : [],
      prisma.payment.findMany({ where: { patientId: patient.id }, orderBy: { paidAt: 'desc' }, take: 100 }),
      prisma.invoice.findMany({ where: { patientId: patient.id }, orderBy: { date: 'desc' }, take: 100 }),
    ]);
    const name = (p?: { title: string | null; firstName: string; lastName: string } | null) => (p ? `${p.title ? `${p.title} ` : ''}${p.firstName} ${p.lastName}` : null);
    const events = [
      ...appointments.map(a => ({ kind: 'APPOINTMENT', id: a.id, date: a.date, title: a.reason || a.type, status: a.status, by: name(a.practitioner) })),
      ...consultations.map(c => ({ kind: 'CONSULTATION', id: c.id, date: c.date, title: c.reason || 'Consultation', status: c.status, by: name(c.practitioner), detail: c.diagnosis })),
      ...acts.map(a => ({ kind: 'ACT', id: a.id, date: a.performedAt || a.updatedAt, title: a.label, detail: [a.teeth && `Dent(s) ${a.teeth}`, a.faces && `faces ${a.faces}`].filter(Boolean).join(' · '), by: name(a.practitioner), amount: toNumber(a.price) })),
      ...prescriptions.map(p => ({ kind: 'PRESCRIPTION', id: p.id, date: p.date, title: 'Ordonnance', by: name(p.practitioner), detail: safeItems(p.items).map((i: any) => i.drug).filter(Boolean).join(', ') })),
      ...documents.map(d => ({ kind: 'DOCUMENT', id: d.id, date: d.createdAt, title: d.title, status: d.type })),
      ...attachments.map(a => ({ kind: 'ATTACHMENT', id: a.id, date: a.createdAt, title: a.title || a.fileName, status: a.type, detail: a.teeth ? `Dent(s) ${a.teeth}` : undefined })),
      ...invoices.map(i => ({ kind: 'INVOICE', id: i.id, date: i.date, title: `Facture ${i.number}`, status: i.status, amount: toNumber(i.total) })),
      ...payments.map(p => ({ kind: 'PAYMENT', id: p.id, date: p.paidAt, title: 'Paiement', status: p.method, amount: toNumber(p.amount) })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    sendSuccess(res, events);
  } catch (err) { next(err); }
});

function safeItems(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default router;
