import { prisma } from '../config/prisma';
import { channelsFor, createInboxMessage, formatDate, formatTime, MessageChannel, sendMessage } from '../services/messaging';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const parseLeads = (value: string | null | undefined) => String(value || '1440,60').split(',').map(Number).filter(n => Number.isFinite(n) && n > 0);

/** Messages sent this calendar month by a cabinet to its patients (counts against the plan quota). */
async function monthlyUsage(cabinetId: string, now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return prisma.message.count({ where: { cabinetId, kind: 'APPOINTMENT_REMINDER', channel: { in: ['SMS', 'WHATSAPP'] }, status: { in: ['SENT', 'LOGGED'] }, createdAt: { gte: monthStart } } });
}

/**
 * Reminds patients of their appointment at each lead time of the cabinet (default: the day before and one hour before).
 * Only patients who consented to reminders are contacted. The text never mentions a diagnosis, treatment or act (F-MSG-04):
 * only the cabinet, the practitioner, the date and the time.
 */
export async function sendAppointmentReminders(now = new Date()) {
  const maxLead = 7 * DAY;
  const appointments = await prisma.appointment.findMany({
    where: {
      deletedAt: null,
      status: { in: ['PLANNED', 'CONFIRMED'] },
      date: { gt: now, lte: new Date(now.getTime() + maxLead) },
      patient: { is: { deletedAt: null, consentRemindersAt: { not: null } } },
      cabinet: { is: { isActive: true, deletedAt: null, remindersEnabled: true, isDemo: false } },
    },
    include: { patient: true, practitioner: true, cabinet: true },
    take: 500,
  });

  const usage = new Map<string, number>();
  let sent = 0;
  for (const appointment of appointments) {
    const { patient, practitioner, cabinet } = appointment;
    if (!patient?.phone) continue;
    const done = new Set(String(appointment.remindersSent || '').split(',').filter(Boolean).map(Number));
    const due = parseLeads(cabinet.reminderLeadMinutes)
      .filter(lead => !done.has(lead) && appointment.date.getTime() - now.getTime() <= lead * MINUTE);
    if (!due.length) continue;
    // Several lead times due at once (appointment booked late): send one reminder, mark all as done.
    const lead = Math.min(...due);

    if (!usage.has(cabinet.id)) usage.set(cabinet.id, await monthlyUsage(cabinet.id, now));
    const channels = channelsFor(cabinet.reminderChannel);
    if ((usage.get(cabinet.id) || 0) + channels.length > cabinet.monthlyMessages) {
      console.warn(`[reminders] quota mensuel atteint pour ${cabinet.name}`);
      continue;
    }

    const time = formatTime(appointment.date);
    const day = formatDate(appointment.date);
    const doctor = `${practitioner.title ? `${practitioner.title} ` : ''}${practitioner.lastName}`.trim();
    const when = lead >= 12 * 60 ? `le ${day} à ${time}` : `aujourd'hui à ${time}`;
    const body = `Bonjour ${patient.firstName}, rappel de votre rendez-vous ${when} avec ${doctor} au ${cabinet.name}.`
      + `${cabinet.phone ? ` Pour annuler ou déplacer : ${cabinet.phone}.` : ''}`;

    for (const channel of channels) {
      const result = await sendMessage({
        kind: 'APPOINTMENT_REMINDER',
        channel,
        toPhone: patient.phone,
        body,
        templateParams: [patient.firstName, cabinet.name, `${day} ${time}`, doctor],
        cabinetId: cabinet.id,
        appointmentId: appointment.id,
        dedupeKey: `appt:${appointment.id}:${lead}:${channel}`,
      });
      if (result && result.status !== 'FAILED') usage.set(cabinet.id, (usage.get(cabinet.id) || 0) + 1);
    }
    due.forEach(value => done.add(value));
    await prisma.appointment.update({ where: { id: appointment.id }, data: { remindersSent: [...done].join(',') } });
    sent += 1;
  }
  return sent;
}

type Stage = '3D' | '1D' | 'EXPIRED';

const expiryText = (stage: Stage, isTrial: boolean, cabinetName: string, endDate: string) => {
  const what = isTrial ? 'Votre essai gratuit' : 'Votre abonnement';
  if (stage === 'EXPIRED') {
    return `${what} Cabinet Pro pour « ${cabinetName} » a expiré le ${endDate}. L'accès est suspendu, vos données sont conservées : connectez-vous pour renouveler ou contactez-nous.`;
  }
  const when = stage === '1D' ? 'demain' : 'dans 3 jours';
  return `${what} Cabinet Pro pour « ${cabinetName} » expire ${when} (${endDate}). Renouvelez maintenant pour éviter toute interruption.`;
};

/** Warns cabinet owners 3 days and 1 day before the end of their plan/trial, and once when it has expired. */
export async function sendPlanExpiryReminders(now = new Date()) {
  const cabinets = await prisma.cabinet.findMany({
    where: { deletedAt: null, isDemo: false, currentPeriodEnd: { gte: new Date(now.getTime() - 2 * DAY), lte: new Date(now.getTime() + 3 * DAY) } },
    include: { users: { where: { role: 'OWNER', deletedAt: null, isActive: true } } },
  });

  for (const cabinet of cabinets) {
    const end = cabinet.currentPeriodEnd!;
    const msLeft = end.getTime() - now.getTime();
    const stage: Stage = msLeft <= 0 ? 'EXPIRED' : msLeft <= DAY ? '1D' : '3D';
    const isTrial = cabinet.subscriptionStatus === 'TRIALING' || (!!cabinet.trialEndsAt && cabinet.trialEndsAt.getTime() >= end.getTime() - MINUTE);
    // A 3-day trial is already "3 days from the end" at sign-up; skip that stage.
    if (isTrial && stage === '3D') continue;

    const endDate = formatDate(end);
    const body = expiryText(stage, isTrial, cabinet.name, endDate);
    const subject = stage === 'EXPIRED' ? (isTrial ? 'Essai gratuit terminé' : 'Abonnement expiré') : (isTrial ? 'Fin de l’essai gratuit' : 'Abonnement bientôt expiré');
    const base = `plan:${cabinet.id}:${end.toISOString()}:${stage}`;
    const channels: MessageChannel[] = ['WHATSAPP', 'SMS'];

    for (const owner of cabinet.users) {
      await createInboxMessage({ kind: 'PLAN_EXPIRY', toUserId: owner.id, cabinetId: cabinet.id, subject, body, fromName: 'Cabinet Pro', dedupeKey: `${base}:inbox:${owner.id}` });
    }
    const phones = new Set(cabinet.users.map(owner => owner.phone).filter(Boolean) as string[]);
    if (!phones.size && cabinet.phone) phones.add(cabinet.phone);
    for (const phone of phones) {
      for (const channel of channels) {
        await sendMessage({ kind: 'PLAN_EXPIRY', channel, toPhone: phone, body, templateParams: [cabinet.name, endDate, subject], cabinetId: cabinet.id, subject, dedupeKey: `${base}:${channel}:${phone}` });
      }
    }
  }
}

/** Deactivates cabinets whose paid period or trial has ended (data is kept). */
export async function expireCabinets(now = new Date()) {
  await prisma.cabinet.updateMany({
    where: { isActive: true, isDemo: false, deletedAt: null, currentPeriodEnd: { lt: now } },
    data: { isActive: false, subscriptionStatus: 'PAST_DUE' },
  });
}

let running = false;

export function startReminderJobs() {
  if (process.env.REMINDERS_DISABLED === 'true') return;
  const interval = Number(process.env.REMINDER_JOB_INTERVAL_MS || MINUTE);
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sendAppointmentReminders();
      await sendPlanExpiryReminders();
      await expireCabinets();
    } catch (err) {
      console.error('[reminders] job failed:', err);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 5000);
  setInterval(tick, interval);
  console.log(`⏰ Rappels actifs (toutes les ${Math.round(interval / 1000)} s)`);
}
