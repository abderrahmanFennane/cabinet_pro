import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireMedicalAccess, requirePermissions } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { findPatientOr404, logPatientAccess, nextNumber, toNumber } from '../../utils/patient-scope';
import { lineTotal, openInvoiceForToday, recomputeInvoice } from '../../utils/billing';
import { dentitionForAge, normalizeFaces, parseTeeth, quadrantTeeth, teethFor, TOOTH_STATES } from '../../utils/dental';

// Mounted at /api/cabinets/:cabinetId/patients/:patientId/dental
const router = Router({ mergeParams: true });
router.use(requireMedicalAccess, requirePermissions('DENTAL_CHART'));

const practitionerSelect = { select: { id: true, firstName: true, lastName: true, title: true } };
const SCOPES = ['NONE', 'TOOTH', 'TEETH', 'QUADRANT', 'MOUTH'] as const;

const wrap = (fn: (value: any) => any) => (value: any) => {
  try {
    return fn(value);
  } catch (err: any) {
    throw new AppError(err.message, 400);
  }
};
const toTeeth = wrap(parseTeeth);
const toFaces = wrap(normalizeFaces);

// ─── Odontogram (F-DEN-01 .. F-DEN-04) ───

router.get('/chart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const [states, planned] = await Promise.all([
      prisma.toothState.findMany({ where: { patientId: patient.id } }),
      prisma.dentalAct.findMany({ where: { patientId: patient.id, status: 'PLANNED' }, select: { id: true, teeth: true, label: true, treatmentPlanId: true } }),
    ]);
    const autoDentition = dentitionForAge(patient.birthDate);
    const dentition = (patient.dentition as any) || autoDentition;
    await logPatientAccess(req, patient.id, 'VIEW_MEDICAL', 'schéma dentaire');
    sendSuccess(res, {
      dentition,
      autoDentition,
      forced: !!patient.dentition,
      teeth: teethFor(dentition),
      states,
      plannedTeeth: [...new Set(planned.flatMap(act => (act.teeth ? act.teeth.split(',').map(Number) : [])))],
    });
  } catch (err) { next(err); }
});

router.patch('/dentition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const { dentition } = z.object({ dentition: z.enum(['PRIMARY', 'MIXED', 'PERMANENT']).nullable() }).parse(req.body);
    await prisma.patient.update({ where: { id: patient.id }, data: { dentition } });
    sendSuccess(res, { dentition: dentition || dentitionForAge(patient.birthDate), forced: !!dentition });
  } catch (err) { next(err); }
});

/** F-DEN-04: tooth sheet — current state, faces, dated acts with practitioner, X-rays, notes, planned acts. */
router.get('/teeth/:tooth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const [tooth] = toTeeth(req.params.tooth);
    const toothMatch = { OR: [{ teeth: String(tooth) }, { teeth: { startsWith: `${tooth},` } }, { teeth: { endsWith: `,${tooth}` } }, { teeth: { contains: `,${tooth},` } }] };
    const [state, acts, attachments] = await Promise.all([
      prisma.toothState.findUnique({ where: { patientId_tooth: { patientId: patient.id, tooth } } }),
      prisma.dentalAct.findMany({ where: { patientId: patient.id, status: { in: ['PLANNED', 'DONE'] }, ...toothMatch }, include: { practitioner: practitionerSelect }, orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }] }),
      prisma.attachment.findMany({ where: { patientId: patient.id, ...toothMatch }, orderBy: { createdAt: 'desc' } }),
    ]);
    sendSuccess(res, {
      tooth,
      state: state || { tooth, state: 'HEALTHY', faces: null, notes: null },
      history: acts.filter(a => a.status === 'DONE'),
      planned: acts.filter(a => a.status === 'PLANNED'),
      attachments,
    });
  } catch (err) { next(err); }
});

router.put('/teeth/:tooth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const [tooth] = toTeeth(req.params.tooth);
    const data = z.object({ state: z.enum(TOOTH_STATES), faces: z.union([z.string(), z.array(z.string())]).nullable().optional(), notes: z.string().nullable().optional() }).parse(req.body);
    const faces = toFaces(data.faces);
    const saved = await prisma.toothState.upsert({
      where: { patientId_tooth: { patientId: patient.id, tooth } },
      update: { state: data.state, faces, notes: data.notes, updatedById: req.user!.id },
      create: { cabinetId: req.params.cabinetId, patientId: patient.id, tooth, state: data.state, faces, notes: data.notes, updatedById: req.user!.id },
    });
    sendSuccess(res, saved, 'Dent mise à jour');
  } catch (err) { next(err); }
});

// ─── Dental acts (F-DEN-05, F-DEN-08) ───

const actInput = z.object({
  actId: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  label: z.string().trim().min(1).optional(),
  scope: z.enum(SCOPES).optional(),
  teeth: z.union([z.string(), z.array(z.number())]).nullable().optional(),
  quadrant: z.number().int().min(1).max(8).optional(),
  faces: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  price: z.number().min(0).optional(),
  status: z.enum(['PLANNED', 'DONE']).default('PLANNED'),
  treatmentPlanId: z.string().nullable().optional(),
  session: z.number().int().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** Builds DentalAct rows from input + catalogue: a per-tooth act on several teeth gives one row per tooth. */
async function buildActs(req: Request, patientId: string, input: z.infer<typeof actInput>) {
  const catalogue = input.actId
    ? await prisma.act.findFirst({ where: { id: input.actId, cabinetId: req.params.cabinetId, deletedAt: null } })
    : null;
  if (input.actId && !catalogue) throw new AppError('Acte introuvable dans le catalogue', 400);
  const label = input.label || catalogue?.name;
  if (!label) throw new AppError('Libellé de l’acte requis', 400);
  const scope = input.scope || (catalogue?.scope as typeof SCOPES[number]) || 'TOOTH';
  const unitPrice = input.price ?? toNumber(catalogue?.price);
  let teeth: number[] = scope === 'QUADRANT' && input.quadrant ? quadrantTeeth(input.quadrant) : toTeeth(input.teeth);
  if (scope === 'MOUTH' || scope === 'NONE') teeth = [];
  if ((scope === 'TOOTH' || scope === 'TEETH' || scope === 'QUADRANT') && !teeth.length) throw new AppError('Sélectionnez au moins une dent', 400);
  const faces = toFaces(input.faces);
  const base = {
    cabinetId: req.params.cabinetId,
    patientId,
    practitionerId: req.user!.role === 'SUPER_ADMIN' ? await anyPractitioner(req.params.cabinetId) : req.user!.id,
    treatmentPlanId: input.treatmentPlanId || null,
    actId: catalogue?.id || null,
    code: input.code ?? catalogue?.code ?? null,
    label,
    scope,
    faces,
    resultingState: catalogue?.resultingState || null,
    status: 'PLANNED',
    session: input.session ?? null,
    notes: input.notes ?? null,
  };
  if (scope === 'TOOTH') return teeth.map((tooth: number) => ({ ...base, teeth: String(tooth), price: unitPrice }));
  return [{ ...base, teeth: teeth.length ? teeth.join(',') : null, price: unitPrice }];
}

async function anyPractitioner(cabinetId: string) {
  const owner = await prisma.user.findFirst({ where: { cabinetId, role: { in: ['OWNER', 'PRACTITIONER'] }, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new AppError('Aucun praticien dans ce cabinet', 400);
  return owner.id;
}

/**
 * Performs an act: marks it done, applies its resulting state to its teeth (e.g. extraction -> MISSING),
 * and bills it on today's invoice unless it belongs to a plan whose quote was accepted (already billed by the quote).
 */
async function performAct(tx: Prisma.TransactionClient, actId: string, userId: string) {
  const act = await tx.dentalAct.update({ where: { id: actId }, data: { status: 'DONE', performedAt: new Date() }, include: { treatmentPlan: { include: { quote: true } } } });
  const teeth = act.teeth ? act.teeth.split(',').map(Number) : [];
  if (act.resultingState) {
    for (const tooth of teeth) {
      await tx.toothState.upsert({
        where: { patientId_tooth: { patientId: act.patientId, tooth } },
        update: { state: act.resultingState, faces: act.resultingState === 'MISSING' ? null : act.faces ?? undefined, updatedById: userId },
        create: { cabinetId: act.cabinetId, patientId: act.patientId, tooth, state: act.resultingState, faces: act.resultingState === 'MISSING' ? null : act.faces, updatedById: userId },
      });
    }
  }
  const coveredByQuote = act.treatmentPlan?.quote?.status === 'ACCEPTED';
  if (!coveredByQuote && toNumber(act.price) > 0) {
    const invoice = await openInvoiceForToday(tx, act.cabinetId, act.patientId, act.practitionerId);
    await tx.invoiceItem.create({
      data: { invoiceId: invoice.id, actId: act.actId, dentalActId: act.id, code: act.code, label: act.label, teeth: act.teeth, faces: act.faces, quantity: 1, unitPrice: act.price, total: lineTotal(toNumber(act.price), 1) },
    });
    await recomputeInvoice(tx, invoice.id);
  }
  if (act.treatmentPlanId) {
    const remaining = await tx.dentalAct.count({ where: { treatmentPlanId: act.treatmentPlanId, status: 'PLANNED' } });
    await tx.treatmentPlan.update({ where: { id: act.treatmentPlanId }, data: { status: remaining ? 'IN_PROGRESS' : 'DONE' } });
  }
  return act;
}

async function findAct(req: Request, patientId: string) {
  const act = await prisma.dentalAct.findFirst({ where: { id: req.params.actId, patientId } });
  if (!act) throw new AppError('Acte introuvable', 404);
  return act;
}

router.get('/acts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const status = z.enum(['PLANNED', 'DONE', 'CANCELLED']).optional().parse(req.query.status);
    sendSuccess(res, await prisma.dentalAct.findMany({ where: { patientId: patient.id, ...(status ? { status } : {}) }, include: { practitioner: practitionerSelect }, orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }] }));
  } catch (err) { next(err); }
});

router.post('/acts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const input = actInput.parse(req.body);
    if (input.treatmentPlanId) await findPlan(req, patient.id, input.treatmentPlanId);
    const rows = await buildActs(req, patient.id, input);
    const acts = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const row of rows) {
        const act = await tx.dentalAct.create({ data: row });
        created.push(input.status === 'DONE' ? await performAct(tx, act.id, req.user!.id) : act);
      }
      return created;
    });
    sendSuccess(res, acts, input.status === 'DONE' ? 'Acte réalisé' : 'Acte planifié', undefined, 201);
  } catch (err) { next(err); }
});

router.post('/acts/:actId/perform', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const act = await findAct(req, patient.id);
    if (act.status !== 'PLANNED') throw new AppError('Cet acte n’est pas planifié', 409);
    const performed = await prisma.$transaction(tx => performAct(tx, act.id, req.user!.id));
    sendSuccess(res, performed, 'Acte réalisé');
  } catch (err) { next(err); }
});

router.patch('/acts/:actId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const act = await findAct(req, patient.id);
    if (act.status !== 'PLANNED') throw new AppError('Seul un acte planifié peut être modifié', 409);
    const data = z.object({ label: z.string().trim().min(1).optional(), price: z.number().min(0).optional(), faces: z.union([z.string(), z.array(z.string())]).nullable().optional(), session: z.number().int().min(1).nullable().optional(), notes: z.string().nullable().optional() }).parse(req.body);
    const updated = await prisma.dentalAct.update({ where: { id: act.id }, data: { ...data, faces: data.faces === undefined ? undefined : toFaces(data.faces) } });
    sendSuccess(res, updated, 'Acte mis à jour');
  } catch (err) { next(err); }
});

router.delete('/acts/:actId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const act = await findAct(req, patient.id);
    if (act.status !== 'PLANNED') throw new AppError('Un acte réalisé ne peut pas être supprimé', 409);
    await prisma.dentalAct.update({ where: { id: act.id }, data: { status: 'CANCELLED' } });
    sendSuccess(res, null, 'Acte annulé');
  } catch (err) { next(err); }
});

// ─── Treatment plans and quotes (F-DEN-06, F-DEN-07) — plan feature DENTAL_TREATMENT_PLAN ───

async function findPlan(req: Request, patientId: string, planId = req.params.planId) {
  const plan = await prisma.treatmentPlan.findFirst({ where: { id: planId, patientId, cabinetId: req.params.cabinetId } });
  if (!plan) throw new AppError('Plan de traitement introuvable', 404);
  return plan;
}

const planInclude = {
  practitioner: practitionerSelect,
  acts: { where: { status: { not: 'CANCELLED' } }, orderBy: [{ session: 'asc' as const }, { createdAt: 'asc' as const }] },
  quote: { select: { id: true, number: true, status: true, total: true } },
};

const serializePlan = (plan: any) => ({
  ...plan,
  total: plan.acts.reduce((sum: number, act: any) => sum + toNumber(act.price), 0),
  done: plan.acts.filter((act: any) => act.status === 'DONE').length,
});

const planRouter = Router({ mergeParams: true });
planRouter.use(requirePermissions('DENTAL_TREATMENT_PLAN'));

planRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const plans = await prisma.treatmentPlan.findMany({ where: { patientId: patient.id }, include: planInclude, orderBy: { createdAt: 'desc' } });
    sendSuccess(res, plans.map(serializePlan));
  } catch (err) { next(err); }
});

planRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const data = z.object({ title: z.string().trim().min(1, 'Titre requis'), notes: z.string().nullable().optional(), acts: z.array(actInput.omit({ status: true, treatmentPlanId: true })).default([]) }).parse(req.body);
    const rows = [];
    for (const act of data.acts) rows.push(...(await buildActs(req, patient.id, { ...act, status: 'PLANNED' })));
    const practitionerId = req.user!.role === 'SUPER_ADMIN' ? await anyPractitioner(req.params.cabinetId) : req.user!.id;
    const plan = await prisma.treatmentPlan.create({
      data: { cabinetId: req.params.cabinetId, patientId: patient.id, practitionerId, title: data.title, notes: data.notes, acts: { create: rows.map(({ treatmentPlanId: _t, ...row }) => row) } },
      include: planInclude,
    });
    sendSuccess(res, serializePlan(plan), 'Plan de traitement créé', undefined, 201);
  } catch (err) { next(err); }
});

planRouter.patch('/:planId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const plan = await findPlan(req, patient.id);
    const data = z.object({ title: z.string().trim().min(1).optional(), notes: z.string().nullable().optional(), status: z.enum(['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional() }).parse(req.body);
    const updated = await prisma.treatmentPlan.update({ where: { id: plan.id }, data, include: planInclude });
    if (data.status === 'CANCELLED') await prisma.dentalAct.updateMany({ where: { treatmentPlanId: plan.id, status: 'PLANNED' }, data: { status: 'CANCELLED' } });
    sendSuccess(res, serializePlan(updated), 'Plan mis à jour');
  } catch (err) { next(err); }
});

/** Quote generated from the plan: its acts, teeth and prices (acceptance criterion 3). */
planRouter.post('/:planId/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const plan = await prisma.treatmentPlan.findFirst({ where: { id: req.params.planId, patientId: patient.id }, include: { acts: { where: { status: { not: 'CANCELLED' } } }, quote: true } });
    if (!plan) throw new AppError('Plan de traitement introuvable', 404);
    if (plan.quote) throw new AppError(`Un devis existe déjà pour ce plan (${plan.quote.number})`, 409);
    if (!plan.acts.length) throw new AppError('Le plan ne contient aucun acte', 400);
    const { validDays } = z.object({ validDays: z.number().int().min(1).max(365).default(30) }).parse(req.body || {});
    const quote = await prisma.$transaction(async (tx) => {
      const total = plan.acts.reduce((sum, act) => sum + toNumber(act.price), 0);
      return tx.quote.create({
        data: {
          cabinetId: req.params.cabinetId, patientId: patient.id, treatmentPlanId: plan.id, practitionerId: plan.practitionerId,
          number: await nextNumber(tx, req.params.cabinetId, 'quote'), total,
          validUntil: new Date(Date.now() + validDays * 86_400_000),
          items: { create: plan.acts.map(act => ({ actId: act.actId, code: act.code, label: act.label, teeth: act.teeth, faces: act.faces, quantity: 1, unitPrice: act.price, total: act.price })) },
        },
        include: { items: true },
      });
    });
    sendSuccess(res, quote, 'Devis créé', undefined, 201);
  } catch (err) { next(err); }
});

router.use('/plans', planRouter);

export default router;
