import { prisma } from '../config/prisma';
import { dayRange, localDay, TIME_ZONE } from '../utils/local-day';

// Online booking: free slots of a doctor from the cabinet's opening hours, appointments and absences.

/** Opening hours per weekday (0 = Sunday): ["09:00-13:00", "15:00-19:00"]. */
export type BookingHours = Record<string, string[]>;

export const DEFAULT_BOOKING_HOURS: BookingHours = {
  0: [], 1: ['09:00-13:00', '15:00-19:00'], 2: ['09:00-13:00', '15:00-19:00'], 3: ['09:00-13:00', '15:00-19:00'],
  4: ['09:00-13:00', '15:00-19:00'], 5: ['09:00-12:00', '15:00-19:00'], 6: ['09:00-13:00'],
};
/** How far ahead patients can book, and the minimum notice before a slot. */
export const BOOKING_DAYS_AHEAD = 60;
const MIN_NOTICE_MS = 60 * 60_000;

export const HOURS_RANGE = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function parseHours(raw?: string | null): BookingHours {
  if (!raw) return DEFAULT_BOOKING_HOURS;
  try { return JSON.parse(raw) as BookingHours; } catch { return DEFAULT_BOOKING_HOURS; }
}

/** "2026-10-05" + n days. */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Slot start instants of a local day according to the opening hours (before removing taken ones). */
function openingSlots(day: string, hours: BookingHours, slotMinutes: number) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const midnight = dayRange(day).start.getTime();
  const slots: Date[] = [];
  // Duplicate ranges saved before overlaps were refused are read once.
  for (const range of new Set(hours[weekday] || [])) {
    if (!HOURS_RANGE.test(range)) continue;
    const [from, to] = range.split('-').map(minutesOf);
    for (let t = from; t + slotMinutes <= to; t += slotMinutes) slots.push(new Date(midnight + t * 60_000));
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

type BookableCabinet = { id: string; bookingHours: string | null; bookingSlotMinutes: number };

/** Free slots of a doctor, day by day, from `fromDay` for `days` days (within the booking horizon). */
export async function freeSlots(cabinet: BookableCabinet, practitionerId: string, fromDay: string, days: number) {
  const today = localDay();
  const lastDay = addDays(today, BOOKING_DAYS_AHEAD);
  const first = fromDay < today ? today : fromDay;
  const list = Array.from({ length: days }, (_, i) => addDays(first, i)).filter(day => day <= lastDay);
  if (!list.length) return [];
  const start = dayRange(list[0]).start;
  const end = dayRange(list[list.length - 1]).end;
  const [appointments, absences] = await Promise.all([
    prisma.appointment.findMany({
      where: { cabinetId: cabinet.id, practitionerId, deletedAt: null, status: { notIn: ['CANCELLED', 'NO_SHOW'] }, date: { gte: new Date(start.getTime() - 8 * 3600_000), lt: end } },
      select: { date: true, durationMinutes: true },
    }),
    prisma.absence.findMany({
      where: { cabinetId: cabinet.id, startsAt: { lt: end }, endsAt: { gt: start }, OR: [{ practitionerId: null }, { practitionerId }] },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  const hours = parseHours(cabinet.bookingHours);
  const slot = cabinet.bookingSlotMinutes;
  const earliest = Date.now() + MIN_NOTICE_MS;
  return list.map(day => ({
    day,
    times: openingSlots(day, hours, slot).filter(at => {
      const s = at.getTime(), e = s + slot * 60_000;
      if (s < earliest) return false;
      if (absences.some(a => a.startsAt.getTime() < e && a.endsAt.getTime() > s)) return false;
      return !appointments.some(a => a.date.getTime() < e && a.date.getTime() + a.durationMinutes * 60_000 > s);
    }).filter((at, i, all) => i === 0 || at.getTime() > all[i - 1].getTime()).map(at => ({ at: at.toISOString(), time: localTime(at) })),
  }));
}

/** "10:30" in the cabinet's time zone: the browser's own time-zone data may differ from the server's. */
export const localTime = (at: Date) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE }).format(at);

/** "Cabinet Dr Alami" -> "cabinet-dr-alami" (accents removed). */
export function slugify(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'cabinet';
}

/** First free booking address based on the cabinet's name. */
export async function uniqueSlug(name: string, cabinetId: string) {
  const base = slugify(name);
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const taken = await prisma.cabinet.findFirst({ where: { bookingSlug: slug, id: { not: cabinetId } }, select: { id: true } });
    if (!taken) return slug;
  }
  return `${base}-${cabinetId.slice(-6)}`;
}

type NamedDoctor = { id: string; title?: string | null; firstName: string; lastName: string };
/**
 * Booking address of each doctor inside the cabinet ("dr-hamza-bennis"), from their name.
 * Two doctors with the same name both get the end of their id, so an address never points to the wrong one.
 */
export function doctorSlugs(doctors: NamedDoctor[]) {
  const base = new Map(doctors.map(d => [d.id, slugify(`${d.title || ''} ${d.firstName} ${d.lastName}`)]));
  const count = new Map<string, number>();
  for (const slug of base.values()) count.set(slug, (count.get(slug) || 0) + 1);
  return new Map(doctors.map(d => {
    const slug = base.get(d.id)!;
    return [d.id, count.get(slug)! > 1 ? `${slug}-${d.id.slice(-5)}` : slug];
  }));
}
