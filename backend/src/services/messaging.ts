import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { normalizePhone } from '../utils/phone';

export type MessageChannel = 'SMS' | 'WHATSAPP';
export type MessageKind = 'APPOINTMENT_REMINDER' | 'PLAN_EXPIRY' | 'OWNER_MESSAGE' | 'WELCOME' | 'TEST' | 'PASSWORD_RESET' | 'PAYMENT_REMINDER' | 'DOCUMENT' | 'ONLINE_BOOKING';

/** Messages to patients that count against the cabinet's monthly allowance (plan). */
export const PATIENT_MESSAGE_KINDS: MessageKind[] = ['APPOINTMENT_REMINDER', 'PAYMENT_REMINDER', 'DOCUMENT'];

// SMS goes through Infobip; WhatsApp through Meta's WhatsApp Cloud API.
// Without credentials a provider runs in "log" mode: the message is stored with status LOGGED but not sent.
const infobip = {
  baseUrl: (process.env.INFOBIP_BASE_URL || '').replace(/\/$/, ''),
  apiKey: process.env.INFOBIP_API_KEY || '',
  sender: process.env.INFOBIP_SMS_SENDER || 'CabinetPro',
};
const whatsapp = {
  token: process.env.WHATSAPP_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
  language: process.env.WHATSAPP_TEMPLATE_LANG || 'fr',
  // Business-initiated WhatsApp messages must use templates approved by Meta.
  templates: {
    APPOINTMENT_REMINDER: process.env.WHATSAPP_TEMPLATE_APPOINTMENT || '',
    PLAN_EXPIRY: process.env.WHATSAPP_TEMPLATE_PLAN_EXPIRY || '',
    OWNER_MESSAGE: process.env.WHATSAPP_TEMPLATE_OWNER_MESSAGE || '',
    WELCOME: '',
    TEST: '',
    PASSWORD_RESET: '',
    PAYMENT_REMINDER: process.env.WHATSAPP_TEMPLATE_PAYMENT || '',
    DOCUMENT: process.env.WHATSAPP_TEMPLATE_DOCUMENT || '',
  } as Record<MessageKind, string>,
};

const smsConfigured = () => !!(infobip.baseUrl && infobip.apiKey);
const whatsappConfigured = () => !!(whatsapp.token && whatsapp.phoneNumberId);

export const providerStatus = () => ({
  sms: { provider: smsConfigured() ? 'infobip' : 'log', sender: infobip.sender },
  whatsapp: {
    provider: whatsappConfigured() ? 'meta' : 'log',
    templates: Object.fromEntries(Object.entries(whatsapp.templates).filter(([, name]) => name)),
  },
});

type ProviderResult = { providerId?: string | null; logged?: boolean };

async function sendSms(to: string, text: string): Promise<ProviderResult> {
  if (!smsConfigured()) {
    console.log(`[sms:log] -> ${to}: ${text}`);
    return { logged: true };
  }
  const res = await fetch(`${infobip.baseUrl}/sms/2/text/advanced`, {
    method: 'POST',
    headers: { Authorization: `App ${infobip.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ messages: [{ destinations: [{ to }], from: infobip.sender, text }] }),
  });
  const payload: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Infobip ${res.status}: ${payload?.requestError?.serviceException?.text || JSON.stringify(payload)}`);
  return { providerId: payload?.messages?.[0]?.messageId || null };
}

async function sendWhatsApp(to: string, kind: MessageKind, text: string, params: string[]): Promise<ProviderResult> {
  if (!whatsappConfigured()) {
    console.log(`[whatsapp:log] -> ${to}: ${text}`);
    return { logged: true };
  }
  const template = whatsapp.templates[kind];
  const body = template
    ? {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: whatsapp.language },
        components: params.length ? [{ type: 'body', parameters: params.map(value => ({ type: 'text', text: value })) }] : [],
      },
    }
    // Free text only reaches users who wrote to the business in the last 24h (or test numbers).
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: false } };

  const res = await fetch(`https://graph.facebook.com/${whatsapp.apiVersion}/${whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${whatsapp.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${payload?.error?.message || JSON.stringify(payload)}`);
  return { providerId: payload?.messages?.[0]?.id || null };
}

export interface SendInput {
  kind: MessageKind;
  channel: MessageChannel;
  toPhone?: string | null;
  body: string;
  /** Values for the WhatsApp template body placeholders {{1}}, {{2}}, ... */
  templateParams?: string[];
  cabinetId?: string | null;
  toUserId?: string | null;
  fromUserId?: string | null;
  fromName?: string | null;
  fromPhone?: string | null;
  subject?: string | null;
  appointmentId?: string | null;
  /** Same key twice = sent once. */
  dedupeKey?: string | null;
}

const isDuplicate = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** Records the message, sends it, and cabinets the outcome. Returns null when the dedupe key was already used. */
export async function sendMessage(input: SendInput) {
  const to = normalizePhone(input.toPhone);
  let record;
  try {
    record = await prisma.message.create({
      data: {
        cabinetId: input.cabinetId || null,
        kind: input.kind,
        channel: input.channel,
        toPhone: to || input.toPhone || null,
        toUserId: input.toUserId || null,
        fromUserId: input.fromUserId || null,
        fromName: input.fromName || null,
        fromPhone: input.fromPhone || null,
        subject: input.subject || null,
        body: input.body,
        appointmentId: input.appointmentId || null,
        dedupeKey: input.dedupeKey || null,
      },
    });
  } catch (err) {
    if (isDuplicate(err)) return null;
    throw err;
  }

  if (!to) {
    return prisma.message.update({ where: { id: record.id }, data: { status: 'FAILED', error: 'Numéro de téléphone manquant ou invalide' } });
  }

  try {
    const result = input.channel === 'SMS'
      ? await sendSms(to, input.body)
      : await sendWhatsApp(to, input.kind, input.body, input.templateParams || []);
    return prisma.message.update({
      where: { id: record.id },
      data: { status: result.logged ? 'LOGGED' : 'SENT', providerId: result.providerId || null, sentAt: new Date() },
    });
  } catch (err: any) {
    console.error(`[messaging] ${input.channel} to ${to} failed:`, err?.message);
    return prisma.message.update({ where: { id: record.id }, data: { status: 'FAILED', error: String(err?.message || err).slice(0, 2000) } });
  }
}

/** In-app inbox item for a user (shown in the top bar bell). */
export async function createInboxMessage(input: Omit<SendInput, 'channel' | 'toPhone' | 'templateParams'> & { toUserId: string }) {
  try {
    return await prisma.message.create({
      data: {
        cabinetId: input.cabinetId || null,
        kind: input.kind,
        channel: 'IN_APP',
        toUserId: input.toUserId,
        fromUserId: input.fromUserId || null,
        fromName: input.fromName || null,
        fromPhone: input.fromPhone || null,
        subject: input.subject || null,
        body: input.body,
        status: 'SENT',
        sentAt: new Date(),
        dedupeKey: input.dedupeKey || null,
      },
    });
  } catch (err) {
    if (isDuplicate(err)) return null;
    throw err;
  }
}

/** Patient messages sent (or logged) by the cabinet since the start of the month. */
export async function monthlyUsage(cabinetId: string, now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return prisma.message.count({ where: { cabinetId, kind: { in: PATIENT_MESSAGE_KINDS }, channel: { in: ['SMS', 'WHATSAPP'] }, status: { in: ['SENT', 'LOGGED'] }, createdAt: { gte: monthStart } } });
}

export const channelsFor = (setting?: string | null): MessageChannel[] => {
  if (setting === 'SMS') return ['SMS'];
  if (setting === 'WHATSAPP') return ['WHATSAPP'];
  return ['WHATSAPP', 'SMS'];
};

const timeZone = process.env.APP_TIMEZONE || 'Africa/Casablanca';
export const formatTime = (date: Date) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
export const formatDate = (date: Date) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }).format(date);
