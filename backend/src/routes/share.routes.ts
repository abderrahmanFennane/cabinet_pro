import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { requirePermissions } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { sendSuccess } from '../utils/response';
import { rateLimit } from '../utils/rate-limit';
import { findPatientOr404 } from '../utils/patient-scope';
import { ageInYears } from '../utils/dental';
import { monthlyUsage, sendMessage } from '../services/messaging';

/**
 * Documents sent to the patient as a link (WhatsApp or SMS) instead of paper.
 * The message carries only the link; the page asks for the patient's date of birth (or, if unknown,
 * the last 4 digits of their phone) before showing anything, and locks after 5 wrong answers.
 */
const KINDS = ['PRESCRIPTION', 'DOCUMENT', 'INVOICE'] as const;
const LABEL: Record<string, string> = { PRESCRIPTION: 'votre ordonnance', DOCUMENT: 'votre document', INVOICE: 'votre facture' };
const VALID_DAYS = 7;
const MAX_TRIES = 5;

const practitionerSelect = { select: { id: true, firstName: true, lastName: true, title: true, specialty: true } };
const parseJson = (v: string | null) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

const shareUrl = (req: Request, token: string) =>
  `${(process.env.FRONTEND_URL || String(req.headers.origin || '')).replace(/\/$/, '')}/d/${token}`;

/** Text sent to the patient: the link only, never the content. */
function shareMessage(patient: { firstName: string; birthDate: Date | null; phone: string | null }, cabinetName: string, kind: string, url: string) {
  const check = patient.birthDate ? 'votre date de naissance vous sera demandée' : patient.phone ? 'les 4 derniers chiffres de votre téléphone vous seront demandés' : null;
  return `Bonjour ${patient.firstName}, voici ${LABEL[kind]} du ${cabinetName} : ${url} (lien valable ${VALID_DAYS} jours${check ? `, ${check}` : ''}).`;
}

async function sendShare(req: Request, patient: { firstName: string; phone: string | null }, cabinet: { id: string; name: string; monthlyMessages: number }, channel: 'WHATSAPP' | 'SMS', message: string, url: string) {
  if (!patient.phone) throw new AppError('Pas de téléphone sur la fiche du patient', 400);
  if ((await monthlyUsage(cabinet.id)) + 1 > cabinet.monthlyMessages) throw new AppError('Quota mensuel de messages atteint (voir votre abonnement)', 403);
  const sent = await sendMessage({ kind: 'DOCUMENT', channel, toPhone: patient.phone, cabinetId: cabinet.id, fromUserId: req.user!.id, body: message, templateParams: [patient.firstName, cabinet.name, url] });
  const status = sent?.status || 'FAILED';
  if (status === 'FAILED') throw new AppError(`Envoi impossible : ${sent?.error || 'erreur du fournisseur'}`, 502);
  return status;
}

// ─── Cabinet side: /api/cabinets/:cabinetId/patients/:patientId/shares ───

export const cabinetShares = Router({ mergeParams: true });

cabinetShares.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ kind: z.enum(KINDS), refId: z.string().min(1), send: z.enum(['WHATSAPP', 'SMS']).optional() }).parse(req.body);
    const perms = req.user!.permissions || [];
    const allowed = body.kind === 'INVOICE' ? perms.includes('MANAGE_BILLING') : perms.includes('PRINT_DOCUMENTS') || perms.includes('VIEW_MEDICAL');
    if (!allowed) throw new AppError('Permission refusée', 403);
    const patient = await findPatientOr404(req);
    const cabinetId = req.params.cabinetId;
    const where = { id: body.refId, cabinetId, patientId: patient.id };
    const exists = body.kind === 'PRESCRIPTION' ? await prisma.prescription.count({ where })
      : body.kind === 'DOCUMENT' ? await prisma.medicalDocument.count({ where })
        : await prisma.invoice.count({ where });
    if (!exists) throw new AppError('Document introuvable', 404);

    const share = await prisma.documentShare.create({
      data: {
        token: randomBytes(24).toString('base64url'), cabinetId, patientId: patient.id, kind: body.kind, refId: body.refId,
        createdById: req.user!.id, expiresAt: new Date(Date.now() + VALID_DAYS * 86_400_000),
      },
    });
    const cabinet = await prisma.cabinet.findUniqueOrThrow({ where: { id: cabinetId } });
    const url = shareUrl(req, share.token);
    const message = shareMessage(patient, cabinet.name, body.kind, url);
    const status = body.send ? await sendShare(req, patient, cabinet, body.send, message, url) : null;
    sendSuccess(res, { id: share.id, url, expiresAt: share.expiresAt, message, phone: patient.phone, status }, 'Lien créé', undefined, 201);
  } catch (err) { next(err); }
});

/** Sends an existing link by SMS or WhatsApp (platform sending, counts in the monthly allowance). */
cabinetShares.post('/:id/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel } = z.object({ channel: z.enum(['WHATSAPP', 'SMS']) }).parse(req.body);
    const patient = await findPatientOr404(req);
    const share = await prisma.documentShare.findFirst({ where: { id: req.params.id, cabinetId: req.params.cabinetId, patientId: patient.id, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!share) throw new AppError('Lien introuvable ou expiré', 404);
    if (share.createdById !== req.user!.id && !(req.user!.permissions || []).includes('MANAGE_PATIENTS')) throw new AppError('Permission refusée', 403);
    const cabinet = await prisma.cabinet.findUniqueOrThrow({ where: { id: share.cabinetId } });
    const url = shareUrl(req, share.token);
    const status = await sendShare(req, patient, cabinet, channel, shareMessage(patient, cabinet.name, share.kind, url), url);
    sendSuccess(res, { status }, status === 'LOGGED' ? 'Message enregistré (envoi automatique non configuré : message journalisé)' : 'Message envoyé');
  } catch (err) { next(err); }
});

cabinetShares.get('/', requirePermissions('MANAGE_PATIENTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    sendSuccess(res, await prisma.documentShare.findMany({
      where: { cabinetId: req.params.cabinetId, patientId: patient.id }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, kind: true, refId: true, createdAt: true, expiresAt: true, openedAt: true, openCount: true, revokedAt: true },
    }));
  } catch (err) { next(err); }
});

cabinetShares.post('/:id/revoke', requirePermissions('MANAGE_PATIENTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const updated = await prisma.documentShare.updateMany({ where: { id: req.params.id, cabinetId: req.params.cabinetId, patientId: patient.id }, data: { revokedAt: new Date() } });
    if (!updated.count) throw new AppError('Lien introuvable', 404);
    sendSuccess(res, null, 'Lien désactivé');
  } catch (err) { next(err); }
});

// ─── Patient side (no account): /api/share/:token ───

export const publicShare = Router();
const openLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Trop de tentatives. Réessayez dans quelques minutes.' });

async function activeShare(token: string) {
  const share = await prisma.documentShare.findUnique({ where: { token } });
  if (!share || share.revokedAt) throw new AppError('Ce lien n’existe pas ou a été désactivé par le cabinet.', 404);
  if (share.expiresAt < new Date()) throw new AppError('Ce lien a expiré. Demandez au cabinet de vous le renvoyer.', 410);
  if (share.failedTries >= MAX_TRIES) throw new AppError('Trop de réponses incorrectes : ce lien est bloqué. Contactez le cabinet.', 423);
  return share;
}

publicShare.get('/:token', openLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const share = await activeShare(req.params.token);
    const [cabinet, patient] = await Promise.all([
      prisma.cabinet.findUnique({ where: { id: share.cabinetId }, select: { name: true, phone: true } }),
      prisma.patient.findUnique({ where: { id: share.patientId }, select: { firstName: true, birthDate: true, phone: true } }),
    ]);
    sendSuccess(res, {
      cabinet, kind: share.kind, firstName: patient?.firstName,
      check: patient?.birthDate ? 'BIRTH_DATE' : patient?.phone ? 'PHONE' : 'NONE', expiresAt: share.expiresAt,
    });
  } catch (err) { next(err); }
});

publicShare.post('/:token', openLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const share = await activeShare(req.params.token);
    const answer = z.object({ birthDate: z.string().optional(), phoneDigits: z.string().optional() }).parse(req.body);
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: share.patientId } });
    const ok = patient.birthDate
      ? answer.birthDate === patient.birthDate.toISOString().slice(0, 10)
      : patient.phone ? (answer.phoneDigits || '').replace(/\D/g, '') === patient.phone.replace(/\D/g, '').slice(-4) : true;
    if (!ok) {
      const updated = await prisma.documentShare.update({ where: { id: share.id }, data: { failedTries: { increment: 1 } } });
      const left = MAX_TRIES - updated.failedTries;
      throw new AppError(left > 0 ? `Réponse incorrecte. Encore ${left} essai(s).` : 'Trop de réponses incorrectes : ce lien est bloqué. Contactez le cabinet.', left > 0 ? 400 : 423);
    }
    await prisma.documentShare.update({ where: { id: share.id }, data: { openCount: { increment: 1 }, openedAt: share.openedAt ?? new Date(), failedTries: 0 } });

    const cabinet = await prisma.cabinet.findUniqueOrThrow({ where: { id: share.cabinetId }, select: { name: true, letterhead: true, address: true, city: true, phone: true, email: true, currency: true } });
    const who = { firstName: patient.firstName, lastName: patient.lastName, sex: patient.sex, age: patient.birthDate ? ageInYears(patient.birthDate) : null };
    let document: unknown;
    if (share.kind === 'PRESCRIPTION') {
      const rx = await prisma.prescription.findFirstOrThrow({ where: { id: share.refId, cabinetId: share.cabinetId }, include: { practitioner: practitionerSelect } });
      document = { date: rx.date, items: parseJson(rx.items) || [], notes: rx.notes, practitioner: rx.practitioner };
    } else if (share.kind === 'DOCUMENT') {
      const doc = await prisma.medicalDocument.findFirstOrThrow({ where: { id: share.refId, cabinetId: share.cabinetId } });
      const practitioner = await prisma.user.findUnique({ where: { id: doc.practitionerId }, ...practitionerSelect });
      document = { createdAt: doc.createdAt, title: doc.title, body: doc.body, practitioner };
    } else {
      document = await prisma.invoice.findFirstOrThrow({
        where: { id: share.refId, cabinetId: share.cabinetId },
        include: {
          patient: { select: { firstName: true, lastName: true, sex: true, cin: true, address: true, coverage: true, coverageNumber: true, insuredName: true, complementaryInsurance: true, complementaryNumber: true } },
          items: { orderBy: { createdAt: 'asc' } }, payments: { orderBy: { paidAt: 'asc' } },
        },
      });
    }
    sendSuccess(res, { kind: share.kind, cabinet, patient: who, document });
  } catch (err) { next(err); }
});
