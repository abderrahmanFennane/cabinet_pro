import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { findPatientOr404 } from '../../utils/patient-scope';

const router = Router({ mergeParams: true });
router.use(requirePermissions('MANAGE_APPOINTMENTS'));

export const APPOINTMENT_STATUSES = ['PLANNED', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION', 'DONE', 'CANCELLED', 'NO_SHOW'] as const;

const include = {
  patient: { select: { id: true, firstName: true, lastName: true, phone: true, birthDate: true } },
  practitioner: { select: { id: true, firstName: true, lastName: true, title: true, specialty: true } },
};

const createSchema = z.object({
  patientId: z.string().min(1, 'Patient requis'),
  practitionerId: z.string().optional(),
  date: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  type: z.string().trim().max(50).default('CONSULTATION'),
  reason: z.string().trim().max(255).nullable().optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  force: z.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({ cancellationReason: z.string().max(255).nullable().optional() });

/** A collaborator only works on their own agenda (rights matrix: "Le sien"). */
const ownAgendaOnly = (req: Request) => req.user?.role === 'PRACTITIONER';

async function resolvePractitioner(req: Request, practitionerId?: string) {
  const id = ownAgendaOnly(req) ? req.user!.id : practitionerId || (req.user?.role === 'OWNER' ? req.user.id : undefined);
  if (!id) throw new AppError('Praticien requis', 400);
  const practitioner = await prisma.user.findFirst({ where: { id, cabinetId: req.params.cabinetId, role: { in: ['OWNER', 'PRACTITIONER'] }, deletedAt: null, isActive: true } });
  if (!practitioner) throw new AppError('Praticien introuvable', 400);
  return practitioner.id;
}

async function assertNoOverlap(cabinetId: string, practitionerId: string, start: Date, minutes: number, ignoreId?: string) {
  const end = new Date(start.getTime() + minutes * 60_000);
  const sameDay = await prisma.appointment.findMany({
    where: {
      cabinetId, practitionerId, deletedAt: null, id: ignoreId ? { not: ignoreId } : undefined,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      date: { gte: new Date(start.getTime() - 8 * 3600_000), lt: end },
    },
    select: { date: true, durationMinutes: true },
  });
  const clash = sameDay.some(a => a.date < end && new Date(a.date.getTime() + a.durationMinutes * 60_000) > start);
  if (clash) throw new AppError('Ce créneau chevauche un autre rendez-vous du praticien', 409);
}

async function findAppointment(req: Request) {
  const appointment = await prisma.appointment.findFirst({ where: { id: req.params.id, cabinetId: req.params.cabinetId, deletedAt: null } });
  if (!appointment) throw new AppError('Rendez-vous introuvable', 404);
  if (ownAgendaOnly(req) && appointment.practitionerId !== req.user!.id) throw new AppError('Rendez-vous d’un autre praticien', 403);
  return appointment;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ from: z.string(), to: z.string(), practitionerId: z.string().optional(), patientId: z.string().optional() }).parse(req.query);
    const where: any = { cabinetId: req.params.cabinetId, deletedAt: null, date: { gte: new Date(q.from), lt: new Date(q.to) } };
    if (ownAgendaOnly(req)) where.practitionerId = req.user!.id;
    else if (q.practitionerId) where.practitionerId = q.practitionerId;
    if (q.patientId) where.patientId = q.patientId;
    sendSuccess(res, await prisma.appointment.findMany({ where, include, orderBy: { date: 'asc' } }));
  } catch (err) { next(err); }
});

/** F-AGD-03: today's waiting room with waiting times, for assistants and practitioners. */
router.get('/waiting-room', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 3600_000);
    const where: any = { cabinetId: req.params.cabinetId, deletedAt: null, date: { gte: start, lt: end }, status: { notIn: ['CANCELLED'] } };
    if (ownAgendaOnly(req)) where.practitionerId = req.user!.id;
    const items = await prisma.appointment.findMany({ where, include, orderBy: [{ arrivedAt: 'asc' }, { date: 'asc' }] });
    const now = Date.now();
    sendSuccess(res, items.map(a => ({ ...a, waitingMinutes: a.arrivedAt && a.status === 'ARRIVED' ? Math.round((now - a.arrivedAt.getTime()) / 60_000) : null })));
  } catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSchema.parse(req.body);
    await findPatientOr404(req, data.patientId);
    const practitionerId = await resolvePractitioner(req, data.practitionerId);
    const date = new Date(data.date);
    if (!data.force) await assertNoOverlap(req.params.cabinetId, practitionerId, date, data.durationMinutes);
    const appointment = await prisma.appointment.create({
      data: {
        cabinetId: req.params.cabinetId, patientId: data.patientId, practitionerId, date,
        durationMinutes: data.durationMinutes, type: data.type, reason: data.reason, status: data.status || 'PLANNED',
      },
      include,
    });
    sendSuccess(res, appointment, 'Rendez-vous créé', undefined, 201);
  } catch (err) { next(err); }
});

/** Patient without an appointment arriving now (salle d'attente). */
router.post('/walk-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ patientId: z.string().min(1), practitionerId: z.string().optional(), reason: z.string().max(255).nullable().optional() }).parse(req.body);
    await findPatientOr404(req, data.patientId);
    const practitionerId = await resolvePractitioner(req, data.practitionerId);
    const now = new Date();
    const appointment = await prisma.appointment.create({
      data: { cabinetId: req.params.cabinetId, patientId: data.patientId, practitionerId, date: now, walkIn: true, status: 'ARRIVED', arrivedAt: now, reason: data.reason },
      include,
    });
    sendSuccess(res, appointment, 'Patient ajouté à la salle d’attente', undefined, 201);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await findAppointment(req);
    const data = updateSchema.parse(req.body);
    if (data.patientId) await findPatientOr404(req, data.patientId);
    const practitionerId = data.practitionerId ? await resolvePractitioner(req, data.practitionerId) : existing.practitionerId;
    const date = data.date ? new Date(data.date) : existing.date;
    const duration = data.durationMinutes ?? existing.durationMinutes;
    if (!data.force && (data.date || data.practitionerId || data.durationMinutes)) {
      await assertNoOverlap(req.params.cabinetId, practitionerId, date, duration, existing.id);
    }
    const { force: _force, status, ...rest } = data;
    const appointment = await prisma.appointment.update({
      where: { id: existing.id },
      data: { ...rest, practitionerId, date, ...(status ? statusTimestamps(status) : {}), status, remindersSent: data.date ? null : undefined },
      include,
    });
    sendSuccess(res, appointment, 'Rendez-vous mis à jour');
  } catch (err) { next(err); }
});

function statusTimestamps(status: string) {
  const now = new Date();
  switch (status) {
    case 'ARRIVED': return { arrivedAt: now };
    case 'IN_CONSULTATION': return { startedAt: now };
    case 'DONE': return { completedAt: now };
    case 'CANCELLED': return { cancelledAt: now };
    default: return {};
  }
}

router.post('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await findAppointment(req);
    const { status, cancellationReason } = z.object({ status: z.enum(APPOINTMENT_STATUSES), cancellationReason: z.string().max(255).optional() }).parse(req.body);
    const appointment = await prisma.appointment.update({
      where: { id: existing.id },
      data: { status, cancellationReason, ...statusTimestamps(status), ...(status === 'ARRIVED' && existing.arrivedAt ? { arrivedAt: existing.arrivedAt } : {}) },
      include,
    });
    sendSuccess(res, appointment, 'Statut mis à jour');
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await findAppointment(req);
    await prisma.appointment.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    sendSuccess(res, null, 'Rendez-vous supprimé');
  } catch (err) { next(err); }
});

export default router;
