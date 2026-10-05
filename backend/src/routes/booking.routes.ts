import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error';
import { sendSuccess } from '../utils/response';
import { rateLimit } from '../utils/rate-limit';
import { normalizePhone } from '../utils/phone';
import { localDay } from '../utils/local-day';
import { SPECIALTIES } from '../types/permissions';
import { addDays, BOOKING_DAYS_AHEAD, doctorSlugs, freeSlots, localTime, parseHours } from '../services/booking';
import { createInboxMessage, formatDate, formatTime } from '../services/messaging';

// Public online booking (no account): /rdv/<specialty> lists the cabinets, then the patient picks a doctor and a slot.
const router = Router();

const specialtySchema = z.enum(SPECIALTIES);
const doctorSelect = { id: true, title: true, firstName: true, lastName: true, specialty: true, avatar: true } as const;

/** Cabinets taking online bookings: switched on, active, subscription running (demo cabinets only outside production). */
const bookableWhere = () => ({
  bookingEnabled: true, bookingSlug: { not: null }, isActive: true, deletedAt: null,
  OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
  ...(process.env.NODE_ENV === 'production' ? { isDemo: false } : {}),
});
const doctorsWhere = { role: { in: ['OWNER', 'PRACTITIONER'] }, isActive: true, deletedAt: null };

type Doctor = { id: string; title: string | null; firstName: string; lastName: string; specialty: string | null; avatar: string | null };
/** Doctors of the cabinet in this specialty (a doctor without a specialty has the cabinet's one). */
const doctorsOf = (cabinet: { specialty: string; users: Doctor[] }, specialty?: string) =>
  cabinet.users.filter(u => !specialty || (u.specialty || cabinet.specialty) === specialty);

const publicCabinet = (c: any, specialty?: string) => {
  // Slugs are computed over every doctor of the cabinet, so a doctor's address does not depend on the page.
  const slugs = doctorSlugs(c.users);
  return {
    slug: c.bookingSlug, name: c.name, address: c.address, city: c.city, phone: c.phone, logo: c.logo, specialty: c.specialty,
    slotMinutes: c.bookingSlotMinutes, hours: parseHours(c.bookingHours), doctors: doctorsOf(c, specialty).map(d => ({ ...d, slug: slugs.get(d.id) })),
  };
};

async function findCabinet(slug: string) {
  const cabinet = await prisma.cabinet.findFirst({ where: { ...bookableWhere(), bookingSlug: slug }, include: { users: { where: doctorsWhere, select: doctorSelect, orderBy: { lastName: 'asc' } } } });
  if (!cabinet) throw new AppError('Ce cabinet ne prend pas de rendez-vous en ligne', 404);
  return cabinet;
}

/** Number of cabinets taking online bookings, per specialty (home of /rdv). */
router.get('/specialties', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [specialties, cabinets] = await Promise.all([
      prisma.specialty.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.cabinet.findMany({ where: bookableWhere(), select: { specialty: true, users: { where: doctorsWhere, select: { specialty: true } } } }),
    ]);
    const counts = new Map<string, number>();
    for (const c of cabinets) for (const s of new Set(c.users.map(u => u.specialty || c.specialty))) counts.set(s, (counts.get(s) || 0) + 1);
    sendSuccess(res, specialties.map(s => ({ code: s.code, name: s.name, cabinets: counts.get(s.code) || 0 })));
  } catch (err) { next(err); }
});

router.get('/cabinets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ specialty: specialtySchema, city: z.string().trim().max(80).optional() }).parse(req.query);
    const cabinets = await prisma.cabinet.findMany({
      where: { ...bookableWhere(), ...(q.city ? { city: { contains: q.city } } : {}) },
      include: { users: { where: doctorsWhere, select: doctorSelect, orderBy: { lastName: 'asc' } } },
      orderBy: { name: 'asc' },
      take: 200,
    });
    const list = cabinets.filter(c => doctorsOf(c, q.specialty).length).map(c => publicCabinet(c, q.specialty));
    // Cities offered in the filter (from every cabinet of the specialty, not only the filtered ones).
    const cities = q.city ? undefined : [...new Set(list.map(c => c.city?.trim()).filter(Boolean) as string[])].sort();
    sendSuccess(res, { cabinets: list, cities });
  } catch (err) { next(err); }
});

router.get('/cabinets/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ specialty: specialtySchema.optional() }).parse(req.query);
    const cabinet = await findCabinet(req.params.slug);
    const result = publicCabinet(cabinet, q.specialty);
    // Wrong specialty in the address: show every doctor rather than an empty page.
    sendSuccess(res, result.doctors.length ? result : publicCabinet(cabinet));
  } catch (err) { next(err); }
});

/** Public page of one doctor: profile, cabinet, and next free time (looked up over the next 4 weeks). */
router.get('/cabinets/:slug/doctors/:doctor', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinet = await findCabinet(req.params.slug);
    const slugs = doctorSlugs(cabinet.users);
    const found = cabinet.users.find(u => slugs.get(u.id) === req.params.doctor);
    if (!found) throw new AppError('Ce praticien ne prend pas de rendez-vous en ligne', 404);
    const profile = await prisma.user.findUnique({ where: { id: found.id }, select: { bio: true, languages: true, consultationFee: true } });
    // The next 3 days with free times (looked up over 4 weeks), shown as quick choices on the page.
    const upcoming: Awaited<ReturnType<typeof freeSlots>> = [];
    for (let week = 0; week < 4 && upcoming.length < 3; week++) {
      const days = await freeSlots(cabinet, found.id, addDays(localDay(), week * 7), 7);
      upcoming.push(...days.filter(d => d.times.length).slice(0, 3 - upcoming.length));
    }
    const nextSlot = upcoming[0] ? { day: upcoming[0].day, ...upcoming[0].times[0] } : null;
    sendSuccess(res, {
      cabinet: publicCabinet(cabinet),
      doctor: {
        ...found, slug: slugs.get(found.id), specialty: found.specialty || cabinet.specialty,
        bio: profile?.bio || null, languages: String(profile?.languages || '').split(',').filter(Boolean), consultationFee: profile?.consultationFee ?? null,
      },
      nextSlot,
      upcoming,
    });
  } catch (err) { next(err); }
});

router.get('/cabinets/:slug/slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ doctorId: z.string().min(1), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), days: z.coerce.number().int().min(1).max(14).default(7) }).parse(req.query);
    const cabinet = await findCabinet(req.params.slug);
    if (!cabinet.users.some(u => u.id === q.doctorId)) throw new AppError('Praticien introuvable', 404);
    const today = localDay();
    sendSuccess(res, { days: await freeSlots(cabinet, q.doctorId, q.from || today, q.days), lastDay: addDays(today, BOOKING_DAYS_AHEAD) });
  } catch (err) { next(err); }
});

const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 6, message: 'Trop de réservations depuis cette connexion. Appelez le cabinet ou réessayez plus tard.' });

router.post('/cabinets/:slug/appointments', limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Honeypot: a hidden field people never fill. Robots get an error and nothing is saved.
    if (req.body?.website) throw new AppError('Réservation impossible', 400);
    const data = z.object({
      doctorId: z.string().min(1),
      date: z.string().datetime(),
      firstName: z.string().trim().min(2, 'Indiquez votre prénom').max(60),
      lastName: z.string().trim().min(2, 'Indiquez votre nom').max(60),
      phone: z.string().trim().min(8, 'Téléphone non valide').max(30).regex(/^[+0-9 ().-]+$/, 'Téléphone non valide'),
      reason: z.string().trim().max(120).nullable().optional(),
      comment: z.string().trim().max(500, 'Le commentaire est trop long (500 caractères maximum)').nullable().optional(),
      consent: z.literal(true, { errorMap: () => ({ message: 'Acceptez que le cabinet vous contacte pour ce rendez-vous' }) }),
      website: z.string().optional(),
    }).parse(req.body);
    const phone = normalizePhone(data.phone);
    if (!phone) throw new AppError('Téléphone non valide', 400);
    const cabinet = await findCabinet(req.params.slug);
    const doctor = cabinet.users.find(u => u.id === data.doctorId);
    if (!doctor) throw new AppError('Praticien introuvable', 404);

    // The slot must still be offered (opening hours, notice, not taken, no absence).
    const at = new Date(data.date);
    const day = localDay(at);
    const [slots] = await freeSlots(cabinet, doctor.id, day, 1);
    if (!slots || slots.day !== day || !slots.times.some(s => s.at === at.toISOString())) throw new AppError('Ce créneau vient d’être pris. Choisissez une autre heure.', 409);

    // Limits against floods: per cabinet per day, and per phone number.
    const since = new Date(Date.now() - 86_400_000);
    const [today, pending] = await Promise.all([
      prisma.appointment.count({ where: { cabinetId: cabinet.id, source: 'ONLINE', createdAt: { gte: since } } }),
      prisma.appointment.findMany({ where: { cabinetId: cabinet.id, source: 'ONLINE', deletedAt: null, status: { in: ['PLANNED', 'CONFIRMED'] }, date: { gte: new Date() } }, select: { patient: { select: { phone: true } } } }),
    ]);
    if (today >= (Number(process.env.ONLINE_BOOKINGS_PER_DAY) || 60)) throw new AppError('La réservation en ligne est momentanément indisponible. Appelez le cabinet.', 429);
    if (pending.filter(a => normalizePhone(a.patient?.phone) === phone).length >= 2) throw new AppError('Vous avez déjà 2 rendez-vous à venir dans ce cabinet. Appelez le cabinet pour en prendre un autre.', 409);

    // Same person already known to the cabinet (phone and last name): no duplicate patient file.
    // (MySQL compares names without case or accents; phones are compared once normalized, whatever their spacing.)
    const candidates = await prisma.patient.findMany({ where: { cabinetId: cabinet.id, deletedAt: null, lastName: data.lastName }, select: { id: true, phone: true }, take: 200 });
    const known = candidates.find(p => normalizePhone(p.phone) === phone);
    const now = new Date();
    const patientId = known?.id ?? (await prisma.patient.create({
      data: { cabinetId: cabinet.id, firstName: data.firstName, lastName: data.lastName.toUpperCase(), phone: data.phone, consentDataAt: now, consentRemindersAt: now, primaryPractitionerId: doctor.id },
    })).id;

    const appointment = await prisma.appointment.create({
      data: {
        cabinetId: cabinet.id, patientId, practitionerId: doctor.id, date: at, durationMinutes: cabinet.bookingSlotMinutes,
        reason: data.reason || null, comment: data.comment || null, source: 'ONLINE', status: cabinet.bookingAutoConfirm ? 'CONFIRMED' : 'PLANNED',
      },
    });
    // Two people booking the same slot at the same instant: the later one gives way.
    const clash = await prisma.appointment.findFirst({
      where: { cabinetId: cabinet.id, practitionerId: doctor.id, deletedAt: null, id: { not: appointment.id }, status: { notIn: ['CANCELLED', 'NO_SHOW'] }, date: at, createdAt: { lte: appointment.createdAt } },
    });
    if (clash) {
      await prisma.appointment.delete({ where: { id: appointment.id } });
      throw new AppError('Ce créneau vient d’être pris. Choisissez une autre heure.', 409);
    }

    // The team sees it in the bell; the assistant confirms it from "Aujourd'hui".
    const staff = await prisma.user.findMany({ where: { cabinetId: cabinet.id, isActive: true, deletedAt: null, role: { in: ['OWNER', 'ASSISTANT'] } }, select: { id: true } });
    const doctorName = `${doctor.title ? `${doctor.title} ` : ''}${doctor.lastName}`;
    const when = `${formatDate(at)} à ${formatTime(at)}`;
    await Promise.all([...new Set([...staff.map(s => s.id), doctor.id])].map(toUserId => createInboxMessage({
      kind: 'ONLINE_BOOKING', cabinetId: cabinet.id, toUserId, appointmentId: appointment.id,
      subject: cabinet.bookingAutoConfirm ? 'Nouveau rendez-vous en ligne' : 'Rendez-vous en ligne à confirmer',
      body: `${data.firstName} ${data.lastName.toUpperCase()} (${data.phone}) — ${doctorName}, le ${when}${data.reason ? ` — ${data.reason}` : ''}${data.comment ? `\n« ${data.comment} »` : ''}`,
    })));

    sendSuccess(res, { date: at, day, time: localTime(at), doctor: doctorName, cabinet: cabinet.name, address: cabinet.address, phone: cabinet.phone, confirmed: cabinet.bookingAutoConfirm },
      cabinet.bookingAutoConfirm ? 'Votre rendez-vous est confirmé.' : 'Demande envoyée : le cabinet vous confirme le rendez-vous par téléphone.', undefined, 201);
  } catch (err) { next(err); }
});

export default router;
