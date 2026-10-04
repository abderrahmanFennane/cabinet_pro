import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { findPatientOr404 } from '../../utils/patient-scope';
import { randomBytes } from 'crypto';
import { dayRange, localDay } from '../../utils/local-day';

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
  // Recurring appointment (physiotherapy sessions, follow-ups...): count includes the first one.
  repeat: z.object({ every: z.enum(['DAY', 'WEEK', 'TWO_WEEKS', 'MONTH']), count: z.number().int().min(2).max(52) }).optional(),
});

/** Dates of a series at the same local time (the UTC offset changes during Ramadan in Morocco). */
function seriesDates(first: Date, every: 'DAY' | 'WEEK' | 'TWO_WEEKS' | 'MONTH', count: number) {
  const day = localDay(first);
  const minutes = Math.round((first.getTime() - dayRange(day).start.getTime()) / 60_000);
  const [y, m, d] = day.split('-').map(Number);
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const at = every === 'MONTH' ? new Date(Date.UTC(y, m - 1 + i, d)) : new Date(Date.UTC(y, m - 1, d + i * (every === 'DAY' ? 1 : every === 'WEEK' ? 7 : 14)));
    // 31st of a month without one: skip rather than slip into the next month
    if (every === 'MONTH' && at.getUTCDate() !== d) continue;
    dates.push(new Date(dayRange(at.toISOString().slice(0, 10)).start.getTime() + minutes * 60_000));
  }
  return dates;
}

const updateSchema = createSchema.omit({ repeat: true }).partial().extend({ cancellationReason: z.string().max(255).nullable().optional() });

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

/** Holiday or absence of the doctor (or closure of the whole cabinet) covering the slot. */
async function absenceAt(cabinetId: string, practitionerId: string, start: Date, minutes: number) {
  const end = new Date(start.getTime() + minutes * 60_000);
  return prisma.absence.findFirst({
    where: { cabinetId, startsAt: { lt: end }, endsAt: { gt: start }, OR: [{ practitionerId: null }, { practitionerId }] },
  });
}
async function assertPresent(cabinetId: string, practitionerId: string, start: Date, minutes: number) {
  const absence = await absenceAt(cabinetId, practitionerId, start, minutes);
  if (absence) throw new AppError(`${absence.practitionerId ? 'Le praticien est absent' : 'Le cabinet est fermé'} à cette date${absence.reason ? ` (${absence.reason})` : ''}`, 409);
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

// ─── Holidays and absences ───

router.get('/absences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() }).parse(req.query);
    const where: any = { cabinetId: req.params.cabinetId };
    if (q.from) where.endsAt = { gt: new Date(q.from) };
    if (q.to) where.startsAt = { lt: new Date(q.to) };
    sendSuccess(res, await prisma.absence.findMany({ where, orderBy: { startsAt: 'asc' }, take: 500 }));
  } catch (err) { next(err); }
});

router.post('/absences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      practitionerId: z.string().nullable().optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), reason: z.string().trim().max(120).nullable().optional(),
    }).parse(req.body);
    const start = new Date(data.startsAt), end = new Date(data.endsAt);
    if (end <= start) throw new AppError('La fin doit être après le début', 400);
    // A collaborator declares only their own absences; closing the whole cabinet is for the owner.
    let practitionerId = data.practitionerId ?? null;
    if (ownAgendaOnly(req)) practitionerId = req.user!.id;
    else if (practitionerId) practitionerId = await resolvePractitioner(req, practitionerId);
    else if (req.user!.role !== 'OWNER' && req.user!.role !== 'SUPER_ADMIN') throw new AppError('Seul le titulaire peut fermer tout le cabinet', 403);
    const booked = await prisma.appointment.count({
      where: { cabinetId: req.params.cabinetId, deletedAt: null, status: { in: ['PLANNED', 'CONFIRMED'] }, date: { gte: start, lt: end }, ...(practitionerId ? { practitionerId } : {}) },
    });
    const absence = await prisma.absence.create({ data: { cabinetId: req.params.cabinetId, practitionerId, startsAt: start, endsAt: end, reason: data.reason || null, createdById: req.user!.id } });
    sendSuccess(res, { ...absence, booked }, booked ? `Absence enregistrée. Attention : ${booked} rendez-vous déjà pris sur cette période, à déplacer.` : 'Absence enregistrée', undefined, 201);
  } catch (err) { next(err); }
});

router.delete('/absences/:absenceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const absence = await prisma.absence.findFirst({ where: { id: req.params.absenceId, cabinetId: req.params.cabinetId } });
    if (!absence) throw new AppError('Absence introuvable', 404);
    if (ownAgendaOnly(req) && absence.practitionerId !== req.user!.id) throw new AppError('Absence d’un autre praticien', 403);
    await prisma.absence.delete({ where: { id: absence.id } });
    sendSuccess(res, null, 'Absence supprimée');
  } catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSchema.parse(req.body);
    await findPatientOr404(req, data.patientId);
    const practitionerId = await resolvePractitioner(req, data.practitionerId);
    const date = new Date(data.date);
    if (!data.force) {
      await assertPresent(req.params.cabinetId, practitionerId, date, data.durationMinutes);
      await assertNoOverlap(req.params.cabinetId, practitionerId, date, data.durationMinutes);
    }
    const base = {
      cabinetId: req.params.cabinetId, patientId: data.patientId, practitionerId,
      durationMinutes: data.durationMinutes, type: data.type, reason: data.reason, status: data.status || 'PLANNED',
    };
    if (!data.repeat) {
      const appointment = await prisma.appointment.create({ data: { ...base, date }, include });
      sendSuccess(res, appointment, 'Rendez-vous créé', undefined, 201);
      return;
    }
    // Series: the first slot is checked above; a later slot already taken is skipped and reported.
    const seriesId = randomBytes(12).toString('hex');
    const created = [];
    const skipped: Date[] = [];
    for (const at of seriesDates(date, data.repeat.every, data.repeat.count)) {
      if (at.getTime() !== date.getTime() && !data.force) {
        try { await assertPresent(req.params.cabinetId, practitionerId, at, data.durationMinutes); await assertNoOverlap(req.params.cabinetId, practitionerId, at, data.durationMinutes); } catch { skipped.push(at); continue; }
      }
      created.push(await prisma.appointment.create({ data: { ...base, date: at, seriesId }, include }));
    }
    sendSuccess(res, { ...created[0], series: { id: seriesId, created: created.length, skipped } },
      skipped.length ? `${created.length} rendez-vous créés, ${skipped.length} créneau(x) déjà pris non réservé(s)` : `${created.length} rendez-vous créés`, undefined, 201);
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
      await assertPresent(req.params.cabinetId, practitionerId, date, duration);
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
    // ?scope=following: this appointment and the next ones of its series (not those already seen)
    if (req.query.scope === 'following' && existing.seriesId) {
      const removed = await prisma.appointment.updateMany({
        where: { cabinetId: req.params.cabinetId, seriesId: existing.seriesId, deletedAt: null, date: { gte: existing.date }, status: { in: ['PLANNED', 'CONFIRMED'] } },
        data: { deletedAt: new Date() },
      });
      sendSuccess(res, { count: removed.count }, `${removed.count} rendez-vous supprimés`);
      return;
    }
    await prisma.appointment.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    sendSuccess(res, null, 'Rendez-vous supprimé');
  } catch (err) { next(err); }
});

export default router;
