import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { toNumber } from '../../utils/patient-scope';
import { COMMON_DRUGS } from '../../data/drugs';
import { specialtyStats } from '../../services/specialty-stats';

// Cabinet-level routes mounted at /api/cabinets/:cabinetId: team, dashboard, access log, support access,
// prescription templates and drug search.
const router = Router({ mergeParams: true });

const DAY = 86_400_000;
const startOfDay = (date = new Date()) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };

router.get('/team', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { cabinetId: req.params.cabinetId, deletedAt: null, isActive: true },
      select: { id: true, firstName: true, lastName: true, title: true, role: true, specialty: true, inpe: true },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
    sendSuccess(res, users);
  } catch (err) { next(err); }
});

/** Section 5.7: day figures, revenue, unpaid, no-show rate, top acts, new patients, plus dental indicators. */
router.get('/dashboard', requirePermissions('VIEW_REPORTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinetId = req.params.cabinetId;
    const own = req.user!.role === 'PRACTITIONER';
    const me = req.user!.id;
    const today = startOfDay();
    const tomorrow = new Date(today.getTime() + DAY);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const since30 = new Date(today.getTime() - 30 * DAY);
    const apptScope = { cabinetId, deletedAt: null, ...(own ? { practitionerId: me } : {}) };
    const invoiceScope = { cabinetId, status: { not: 'CANCELLED' }, ...(own ? { practitionerId: me } : {}) };

    const [todayAppointments, seenToday, paymentsToday, paymentsMonth, unpaid, last30, newPatients, topActs, plansInProgress, quotesOpen] = await Promise.all([
      prisma.appointment.count({ where: { ...apptScope, date: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } } }),
      prisma.appointment.count({ where: { ...apptScope, date: { gte: today, lt: tomorrow }, status: 'DONE' } }),
      prisma.payment.aggregate({ where: { cabinetId, paidAt: { gte: today, lt: tomorrow }, ...(own ? { invoice: { practitionerId: me } } : {}) }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { cabinetId, paidAt: { gte: monthStart }, ...(own ? { invoice: { practitionerId: me } } : {}) }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { ...invoiceScope, status: { in: ['OPEN', 'PARTIAL'] } }, _sum: { total: true, paid: true }, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['status'], where: { ...apptScope, date: { gte: since30, lt: tomorrow } }, _count: { _all: true } }),
      prisma.patient.count({ where: { cabinetId, deletedAt: null, createdAt: { gte: monthStart } } }),
      prisma.invoiceItem.groupBy({ by: ['label'], where: { invoice: { ...invoiceScope, date: { gte: since30 } } }, _count: { _all: true }, _sum: { total: true }, orderBy: { _count: { label: 'desc' } }, take: 6 }),
      prisma.treatmentPlan.count({ where: { cabinetId, status: { in: ['ACCEPTED', 'IN_PROGRESS'] }, ...(own ? { practitionerId: me } : {}) } }),
      prisma.quote.count({ where: { cabinetId, status: { in: ['DRAFT', 'SENT'] } } }),
    ]);

    const counted = last30.reduce((s, g) => s + g._count._all, 0);
    const noShows = last30.find(g => g.status === 'NO_SHOW')?._count._all || 0;

    let revenueByMonth: { month: string; total: number }[] | null = null;
    if (req.user!.permissions?.includes('ADVANCED_STATS')) {
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const payments = await prisma.payment.findMany({ where: { cabinetId, paidAt: { gte: sixMonthsAgo }, ...(own ? { invoice: { practitionerId: me } } : {}) }, select: { amount: true, paidAt: true } });
      revenueByMonth = Array.from({ length: 6 }, (_, i) => {
        const start = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        return { month: start.toISOString().slice(0, 7), total: payments.filter(p => p.paidAt >= start && p.paidAt < end).reduce((s, p) => s + toNumber(p.amount), 0) };
      });
    }

    sendSuccess(res, {
      todayAppointments,
      seenToday,
      revenueToday: toNumber(paymentsToday._sum.amount),
      revenueMonth: toNumber(paymentsMonth._sum.amount),
      unpaid: { amount: toNumber(unpaid._sum.total) - toNumber(unpaid._sum.paid), invoices: unpaid._count._all },
      noShowRate: counted ? noShows / counted : 0,
      newPatients,
      topActs: topActs.map(a => ({ label: a.label, count: a._count._all, total: toNumber(a._sum.total) })),
      dental: { plansInProgress, quotesOpen },
      revenueByMonth,
    });
  } catch (err) { next(err); }
});

/**
 * Who opened which patient record (owner only).
 * Platform (Super Admin) activity is only shown in the Super Admin's own audit log, never to cabinet users.
 */
router.get('/access-log', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({ patientId: z.string().optional(), action: z.string().optional(), take: z.coerce.number().int().min(1).max(500).default(200) }).parse(req.query);
    const hidePlatform = req.user!.role !== 'SUPER_ADMIN';
    const platformIds = hidePlatform ? (await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })).map(u => u.id) : [];
    const logs = await prisma.patientAccessLog.findMany({
      where: {
        cabinetId: req.params.cabinetId,
        ...(q.patientId ? { patientId: q.patientId } : {}),
        AND: [
          q.action ? { action: q.action } : {},
          hidePlatform ? { userId: { notIn: platformIds }, action: { not: 'SUPPORT_VIEW' } } : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: q.take,
    });
    const [users, patients] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: [...new Set(logs.map(l => l.userId))] } }, select: { id: true, firstName: true, lastName: true, role: true } }),
      prisma.patient.findMany({ where: { id: { in: [...new Set(logs.map(l => l.patientId))] } }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const userById = new Map(users.map(u => [u.id, u]));
    const patientById = new Map(patients.map(p => [p.id, p]));
    sendSuccess(res, logs.map(log => ({ ...log, user: userById.get(log.userId) || null, patient: patientById.get(log.patientId) || null })));
  } catch (err) { next(err); }
});

// ─── Support access granted by the owner (F-SA-04) ───

router.get('/support-grants', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.supportAccessGrant.findMany({ where: { cabinetId: req.params.cabinetId }, orderBy: { createdAt: 'desc' }, take: 20 }));
  } catch (err) { next(err); }
});

router.post('/support-grants', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'OWNER') throw new AppError('Seul le médecin titulaire peut autoriser un accès support', 403);
    const data = z.object({ hours: z.number().int().min(1).max(72).default(24), readOnly: z.boolean().default(true), reason: z.string().max(190).optional() }).parse(req.body);
    await prisma.supportAccessGrant.updateMany({ where: { cabinetId: req.params.cabinetId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
    const grant = await prisma.supportAccessGrant.create({
      data: { cabinetId: req.params.cabinetId, grantedById: req.user!.id, readOnly: data.readOnly, reason: data.reason, expiresAt: new Date(Date.now() + data.hours * 3600_000) },
    });
    sendSuccess(res, grant, 'Accès support autorisé', undefined, 201);
  } catch (err) { next(err); }
});

router.delete('/support-grants/:id', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.supportAccessGrant.updateMany({ where: { id: req.params.id, cabinetId: req.params.cabinetId, revokedAt: null }, data: { revokedAt: new Date() } });
    sendSuccess(res, null, 'Accès support révoqué');
  } catch (err) { next(err); }
});

// ─── Prescription templates and drug search ───

router.get('/prescription-templates', requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.prescriptionTemplate.findMany({
      where: { cabinetId: req.params.cabinetId, OR: [{ practitionerId: null }, { practitionerId: req.user!.id }] },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, templates.map(t => ({ ...t, items: JSON.parse(t.items) })));
  } catch (err) { next(err); }
});

router.post('/prescription-templates', requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      name: z.string().trim().min(1),
      shared: z.boolean().default(false),
      items: z.array(z.object({ drug: z.string().min(1), dosage: z.string().nullable().optional(), duration: z.string().nullable().optional(), notes: z.string().nullable().optional() })).min(1),
    }).parse(req.body);
    const template = await prisma.prescriptionTemplate.create({
      data: { cabinetId: req.params.cabinetId, practitionerId: data.shared ? null : req.user!.id, name: data.name, items: JSON.stringify(data.items) },
    });
    sendSuccess(res, { ...template, items: data.items }, 'Modèle enregistré', undefined, 201);
  } catch (err) { next(err); }
});

router.delete('/prescription-templates/:id', requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.prescriptionTemplate.deleteMany({ where: { id: req.params.id, cabinetId: req.params.cabinetId } });
    sendSuccess(res, null, 'Modèle supprimé');
  } catch (err) { next(err); }
});

/**
 * Key numbers of each specialty practised in the cabinet (a collaborator: their own specialty and patients only).
 * The lists of patients behind an alert are given only to users who may read medical content.
 */
router.get('/specialty-stats', requirePermissions('VIEW_REPORTS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinetId = req.params.cabinetId;
    const own = req.user!.role === 'PRACTITIONER';
    const specialties = own
      ? [req.user!.specialty || 'GENERAL']
      : [...new Set((await prisma.user.findMany({ where: { cabinetId, deletedAt: null, isActive: true, role: { in: ['OWNER', 'PRACTITIONER'] } }, select: { specialty: true } })).map(u => u.specialty || 'GENERAL'))];
    const medical = (req.user!.permissions || []).includes('VIEW_MEDICAL');
    const result = await Promise.all(specialties.map(async specialty => ({
      specialty,
      stats: (await specialtyStats(prisma as any, { cabinetId, practitionerId: own ? req.user!.id : undefined }, specialty))
        .map(s => (medical ? s : { ...s, patients: undefined })),
    })));
    sendSuccess(res, result.filter(r => r.stats.length));
  } catch (err) { next(err); }
});

/**
 * First-steps guide for a new cabinet (owner only). Every step is checked from the data itself,
 * so it ticks on its own as the clinic gets set up.
 */
router.get('/setup-guide', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cabinetId = req.params.cabinetId;
    const cabinet = await prisma.cabinet.findUnique({ where: { id: cabinetId } });
    if (!cabinet) throw new AppError('Cabinet introuvable', 404);
    const afterSetup = new Date(cabinet.createdAt.getTime() + 5 * 60_000);
    const [team, patients, appointments, actsEdited, me] = await Promise.all([
      prisma.user.count({ where: { cabinetId, deletedAt: null } }),
      prisma.patient.count({ where: { cabinetId, deletedAt: null } }),
      prisma.appointment.count({ where: { cabinetId, deletedAt: null } }),
      prisma.act.count({ where: { cabinetId, OR: [{ updatedAt: { gt: afterSetup } }, { createdAt: { gt: afterSetup } }] } }),
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { totpEnabledAt: true, inpe: true } }),
    ]);
    const steps = [
      { key: 'profile', done: !!(cabinet.address && cabinet.phone), path: '/settings?tab=cabinet' },
      { key: 'letterhead', done: !!(cabinet.letterhead && me?.inpe), path: '/settings?tab=cabinet' },
      { key: 'acts', done: actsEdited > 0, path: '/settings?tab=acts' },
      { key: 'team', done: team > 1, path: '/team' },
      { key: 'patients', done: patients > 0, path: '/patients' },
      { key: 'appointment', done: appointments > 0, path: '/agenda' },
      { key: 'security', done: !!me?.totpEnabledAt || req.user!.role === 'SUPER_ADMIN', path: '/account' },
    ];
    sendSuccess(res, { hidden: !!cabinet.setupGuideHiddenAt, done: steps.filter(s => s.done).length, steps });
  } catch (err) { next(err); }
});

router.post('/setup-guide/:action(hide|show)', requirePermissions('MANAGE_SETTINGS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.cabinet.update({ where: { id: req.params.cabinetId }, data: { setupGuideHiddenAt: req.params.action === 'hide' ? new Date() : null } });
    sendSuccess(res, null);
  } catch (err) { next(err); }
});

// ─── ICD-10 coding of the diagnosis ───

router.get('/diagnosis-codes', requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = String(req.query.search || '').trim();
    if (search.length < 2) { sendSuccess(res, []); return; }
    const code = search.toUpperCase().replace(/\s/g, '');
    // Word stems ("lombaire" -> "lomba", "dépression" -> "dépre") so that "douleur lombaire" finds "Lombalgie"
    // and "dépression" finds "Épisode dépressif". The database collation ignores accents and case.
    const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    // Everyday words doctors type quickly
    const SYNONYMS: [RegExp, string][] = [
      [/mal de dos|dos/, 'lombalgie dorsalgie'], [/rhume/, 'rhinopharyngite'], [/tension|hta/, 'hypertension'],
      [/sucre/, 'diabete'], [/crise cardiaque/, 'infarctus'], [/gorge/, 'pharyngite amygdalite'], [/ventre/, 'abdominale'],
      [/depression|deprime/, 'depressif'], [/stress|angoisse/, 'anxiete'], [/cholesterol/, 'hypercholesterolemie'],
      [/regles/, 'menorragies dysmenorrhee'], [/grossesse|enceinte/, 'grossesse'], [/vaccin/, 'vaccination'], [/certificat/, 'certificat'],
    ];
    const query = plain(search) + ' ' + SYNONYMS.filter(([re]) => re.test(plain(search))).map(([, s]) => s).join(' ');
    const STOP = ['des', 'les', 'une', 'avec', 'sans', 'mal', 'dos'];
    const stems = [...new Set(query.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.includes(w)).map(w => w.slice(0, 5)))];
    const codes = await prisma.diagnosisCode.findMany({
      where: { OR: [...(/^[A-Z][0-9]/.test(code) ? [{ code: { startsWith: code } }] : []), ...stems.map(w => ({ label: { contains: w } }))] },
      orderBy: { code: 'asc' }, take: 300,
    });
    // Code match first, then labels with the most stems
    const score = (c: { code: string; label: string }) => (c.code.startsWith(code) ? 100 : 0) + stems.filter(w => plain(c.label).includes(w)).length;
    sendSuccess(res, codes.sort((a, b) => score(b) - score(a)).slice(0, 15));
  } catch (err) { next(err); }
});

// ─── Consultation templates (personal, or shared with the cabinet) ───

const templateSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(80),
  shared: z.boolean().optional(),
  reason: z.string().nullable().optional(),
  examination: z.string().nullable().optional(),
  diagnosis: z.string().nullable().optional(),
  diagnosisCode: z.string().trim().max(10).nullable().optional(),
  plan: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function ownTemplate(req: Request) {
  const template = await prisma.consultationTemplate.findFirst({ where: { id: req.params.id, cabinetId: req.params.cabinetId } });
  if (!template) throw new AppError('Modèle introuvable', 404);
  // A shared template is managed by its author or the owner; a personal one by its author only.
  if (template.userId ? template.userId !== req.user!.id : req.user!.role !== 'OWNER' && req.user!.role !== 'SUPER_ADMIN') {
    throw new AppError('Seul l’auteur (ou le titulaire pour un modèle partagé) peut le modifier', 403);
  }
  return template;
}

router.get('/consultation-templates', requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.consultationTemplate.findMany({
      where: { cabinetId: req.params.cabinetId, OR: [{ userId: null }, { userId: req.user!.id }] },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, templates.map(({ userId, ...t }) => ({ ...t, shared: !userId, mine: userId === req.user!.id })));
  } catch (err) { next(err); }
});

router.post('/consultation-templates', requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shared, ...data } = templateSchema.parse(req.body);
    const template = await prisma.consultationTemplate.create({ data: { ...data, cabinetId: req.params.cabinetId, userId: shared ? null : req.user!.id } });
    sendSuccess(res, template, 'Modèle enregistré', undefined, 201);
  } catch (err) { next(err); }
});

router.patch('/consultation-templates/:id', requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await ownTemplate(req);
    const { shared: _shared, ...data } = templateSchema.partial().parse(req.body);
    sendSuccess(res, await prisma.consultationTemplate.update({ where: { id: template.id }, data }), 'Modèle mis à jour');
  } catch (err) { next(err); }
});

router.delete('/consultation-templates/:id', requirePermissions('MANAGE_CONSULTATIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await ownTemplate(req);
    await prisma.consultationTemplate.delete({ where: { id: template.id } });
    sendSuccess(res, null, 'Modèle supprimé');
  } catch (err) { next(err); }
});

router.get('/drugs',requirePermissions('MANAGE_PRESCRIPTIONS'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const recent = await prisma.prescription.findMany({ where: { cabinetId: req.params.cabinetId }, select: { items: true }, orderBy: { date: 'desc' }, take: 200 });
    const used = new Set<string>();
    for (const p of recent) {
      try { for (const item of JSON.parse(p.items)) if (item?.drug) used.add(item.drug); } catch { /* ignore malformed rows */ }
    }
    // The cabinet's own recent medicines first, then the national list (name or generic name).
    const mine = [...used].filter(name => !search || name.toLowerCase().includes(search)).slice(0, 8)
      .map(name => ({ name, detail: 'Déjà prescrit au cabinet' }));
    const national = search.length < 2
      ? COMMON_DRUGS.filter(d => !used.has(d.name)).slice(0, 12).map(d => ({ name: d.name, detail: d.form }))
      : (await prisma.drug.findMany({
        where: { isActive: true, OR: [{ name: { contains: search } }, { dci: { contains: search } }] },
        orderBy: [{ name: 'asc' }], take: 40,
        select: { name: true, dci: true, form: true, presentation: true, ppv: true, refundRate: true, generic: true },
      })).map(d => ({
        name: `${d.name}${d.form ? `, ${d.form}` : ''}`,
        detail: [d.dci, d.presentation, d.ppv ? `${Number(d.ppv).toFixed(2)} DH` : null, d.refundRate ? `remb. ${d.refundRate} %` : null, d.generic ? 'générique' : null].filter(Boolean).join(' · '),
      }));
    const seen = new Set<string>();
    sendSuccess(res, [...mine, ...national].filter(d => !seen.has(d.name) && seen.add(d.name)).slice(0, 25));
  } catch (err) { next(err); }
});

export default router;
