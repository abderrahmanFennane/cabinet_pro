import { PrismaClient } from '@prisma/client';

/**
 * Key numbers of each specialty for the home page (statistics). Clinical data is stored encrypted,
 * so the figures are computed here from the decrypted records, over a bounded window.
 */
export type Stat = { key: string; value: number; tone?: 'good' | 'warn' | 'bad'; patients?: { id: string; name: string; detail: string }[] };
export type SpecialtyStats = { specialty: string; stats: Stat[] };

const DAY = 86_400_000;
const parse = (s: string) => { try { return JSON.parse(s); } catch { return {}; } };

type Scope = { cabinetId: string; practitionerId?: string };
type Rec = { patientId: string; date: Date; data: any; kind: string; id: string; patient: { firstName: string; lastName: string; birthDate: Date | null; sex: string | null } };

async function records(prisma: PrismaClient, scope: Scope, kinds: string[], since?: Date): Promise<Rec[]> {
  const rows = await prisma.clinicalRecord.findMany({
    where: { cabinetId: scope.cabinetId, kind: { in: kinds }, deletedAt: null, private: false, ...(scope.practitionerId ? { practitionerId: scope.practitionerId } : {}), ...(since ? { date: { gte: since } } : {}) },
    select: { id: true, patientId: true, date: true, kind: true, data: true, patient: { select: { firstName: true, lastName: true, birthDate: true, sex: true } } },
    orderBy: { date: 'desc' },
    take: 20_000,
  });
  return rows.map(r => ({ ...r, data: parse(r.data) }));
}

/** Most recent record of each patient. */
const latestByPatient = (rows: Rec[]) => {
  const map = new Map<string, Rec>();
  for (const r of rows) if (!map.has(r.patientId)) map.set(r.patientId, r);
  return [...map.values()];
};
const who = (r: Rec, detail: string) => ({ id: r.patientId, name: `${r.patient.lastName} ${r.patient.firstName}`, detail });

// PNI schedule (months) used for "late vaccines"; same as the pediatrics screen.
const PNI: [string, number, boolean?][] = [
  ['BCG', 0], ['HB0', 0], ['VPO0', 0], ['PENTA1', 2], ['VPO1', 2], ['PNEUMO1', 2], ['ROTA1', 2], ['PENTA2', 3], ['VPO2', 3], ['ROTA2', 3],
  ['PENTA3', 4], ['VPO3', 4], ['VPI', 4], ['PNEUMO2', 4], ['RR1', 9], ['PNEUMO3', 12], ['RR2', 18], ['DTC_R1', 18], ['VPO_R1', 18], ['DTC_R2', 60], ['VPO_R2', 60], ['HPV', 132, true],
];

export async function specialtyStats(prisma: PrismaClient, scope: Scope, specialty: string, now = new Date()): Promise<Stat[]> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearAgo = new Date(now.getTime() - 365 * DAY);

  switch (specialty) {
    case 'GENERAL': {
      const latest = latestByPatient(await records(prisma, scope, ['VITALS'], yearAgo));
      const highBp = latest.filter(r => r.data.systolic >= 140 || r.data.diastolic >= 90);
      const diabetes = latest.filter(r => r.data.hba1c >= 7);
      return [
        { key: 'followed', value: latest.length },
        { key: 'highBp', value: highBp.length, tone: highBp.length ? 'warn' : 'good', patients: highBp.slice(0, 10).map(r => who(r, `${r.data.systolic}/${r.data.diastolic} mmHg`)) },
        { key: 'hba1cHigh', value: diabetes.length, tone: diabetes.length ? 'warn' : 'good', patients: diabetes.slice(0, 10).map(r => who(r, `HbA1c ${r.data.hba1c} %`)) },
      ];
    }
    case 'PEDIATRICS': {
      const [growth, vaccines] = await Promise.all([records(prisma, scope, ['GROWTH'], yearAgo), records(prisma, scope, ['VACCINE'])]);
      const children = new Map<string, Rec>();
      for (const r of [...growth, ...vaccines]) if (!children.has(r.patientId)) children.set(r.patientId, r);
      const done = new Map<string, Set<string>>();
      for (const v of vaccines) (done.get(v.patientId) || done.set(v.patientId, new Set()).get(v.patientId)!).add(v.data.code);
      const late: { id: string; name: string; detail: string }[] = [];
      for (const r of children.values()) {
        if (!r.patient.birthDate) continue;
        const months = (now.getTime() - r.patient.birthDate.getTime()) / (30.4375 * DAY);
        const missing = PNI.filter(([code, m, girls]) => months > m + 1 && (!girls || r.patient.sex !== 'M') && !done.get(r.patientId)?.has(code));
        if (missing.length) late.push(who(r, missing.slice(0, 3).map(m => m[0]).join(', ') + (missing.length > 3 ? '…' : '')));
      }
      const vaccinesThisMonth = vaccines.filter(v => v.date >= monthStart).length;
      return [
        { key: 'children', value: children.size },
        { key: 'vaccinesMonth', value: vaccinesThisMonth, tone: 'good' },
        { key: 'lateVaccines', value: late.length, tone: late.length ? 'bad' : 'good', patients: late.slice(0, 10) },
      ];
    }
    case 'GYNECOLOGY': {
      const pregnancies = (await records(prisma, scope, ['PREGNANCY'])).filter(r => (r.data.status || 'ONGOING') === 'ONGOING');
      // Due date from the LMP corrected by the dating ultrasound when there is one.
      const termOf = (r: { data: any }) => new Date(new Date(r.data.datingLmp || r.data.lmp).getTime() + 280 * DAY);
      const dueSoon = pregnancies.filter(r => {
        const term = termOf(r);
        return term.getTime() - now.getTime() <= 30 * DAY;
      });
      // Each follow-up keeps only what was filled that day: take the latest record that has a smear date.
      const smears = latestByPatient((await records(prisma, scope, ['GYN_FOLLOWUP'])).filter(r => r.data.lastSmear));
      const overdue = smears.filter(r => r.data.lastSmear && now.getTime() - new Date(r.data.lastSmear).getTime() > 3 * 365 * DAY);
      return [
        { key: 'pregnancies', value: pregnancies.length },
        { key: 'dueSoon', value: dueSoon.length, tone: dueSoon.length ? 'warn' : 'good', patients: dueSoon.slice(0, 10).map(r => who(r, `terme ${termOf(r).toLocaleDateString('fr-FR')}`)) },
        { key: 'smearOverdue', value: overdue.length, tone: overdue.length ? 'warn' : 'good', patients: overdue.slice(0, 10).map(r => who(r, `dernier frottis ${new Date(r.data.lastSmear).toLocaleDateString('fr-FR')}`)) },
      ];
    }
    case 'OPHTHALMOLOGY': {
      const [exams, glasses] = await Promise.all([records(prisma, scope, ['EYE_EXAM'], yearAgo), records(prisma, scope, ['GLASSES'], monthStart)]);
      const highIop = latestByPatient(exams).filter(r => (r.data.od?.iop ?? 0) > 21 || (r.data.os?.iop ?? 0) > 21);
      const plans = latestByPatient(await records(prisma, scope, ['GLAUCOMA_PLAN']))
      const overdue = plans.filter(r => r.data.nextVisualField && new Date(r.data.nextVisualField).getTime() < now.getTime())
      return [
        { key: 'examsMonth', value: exams.filter(r => r.date >= monthStart).length },
        { key: 'glaucoma', value: plans.length },
        { key: 'vfOverdue', value: overdue.length, tone: overdue.length ? 'warn' : 'good', patients: overdue.slice(0, 10).map(r => who(r, `champ visuel prévu le ${new Date(r.data.nextVisualField).toLocaleDateString('fr-FR')}`)) },
        { key: 'glassesMonth', value: glasses.length },
        { key: 'highIop', value: highIop.length, tone: highIop.length ? 'warn' : 'good', patients: highIop.slice(0, 10).map(r => who(r, `OD ${r.data.od?.iop ?? '—'} / OG ${r.data.os?.iop ?? '—'} mmHg`)) },
      ];
    }
    case 'CARDIOLOGY': {
      const [readings, ecgs] = await Promise.all([records(prisma, scope, ['CARDIO_READING'], yearAgo), records(prisma, scope, ['ECG'], monthStart)]);
      const latest = latestByPatient(readings);
      const uncontrolled = latest.filter(r => r.data.systolic >= 140 || r.data.diastolic >= 90);
      const inrOut = latest.filter(r => r.data.inr != null && (r.data.inr < 2 || r.data.inr > 3));
      return [
        { key: 'followed', value: latest.length },
        { key: 'uncontrolled', value: uncontrolled.length, tone: uncontrolled.length ? 'warn' : 'good', patients: uncontrolled.slice(0, 10).map(r => who(r, `${r.data.systolic}/${r.data.diastolic} mmHg`)) },
        { key: 'inrOut', value: inrOut.length, tone: inrOut.length ? 'bad' : 'good', patients: inrOut.slice(0, 10).map(r => who(r, `INR ${r.data.inr}`)) },
        { key: 'ecgMonth', value: ecgs.length },
      ];
    }
    case 'DERMATOLOGY': {
      const all = await records(prisma, scope, ['LESION']);
      const lesions = latestByPatient(all).length;
      const active = all.filter(r => r.data.status === 'ACTIVE');
      const suspect = active.filter(r => /suspect|mélan|melan|carcinom/i.test(`${r.data.type || ''} ${r.data.description || ''}`));
      return [
        { key: 'patientsWithLesions', value: lesions },
        { key: 'activeLesions', value: active.length },
        { key: 'suspectLesions', value: suspect.length, tone: suspect.length ? 'bad' : 'good', patients: suspect.slice(0, 10).map(r => who(r, r.data.type || 'lésion suspecte')) },
      ];
    }
    case 'PHYSIOTHERAPY': {
      const [programs, sessions] = await Promise.all([records(prisma, scope, ['PHYSIO_PROGRAM']), records(prisma, scope, ['PHYSIO_SESSION'], monthStart)]);
      const ongoing = programs.filter(r => (r.data.status || 'ONGOING') === 'ONGOING');
      const all = await records(prisma, scope, ['PHYSIO_SESSION']);
      const count = new Map<string, number>();
      for (const s of all) count.set(s.data.programId, (count.get(s.data.programId) || 0) + 1);
      const almostDone = ongoing.filter(p => (count.get(p.id) || 0) >= Number(p.data.sessionsPrescribed) - 1);
      return [
        { key: 'programs', value: ongoing.length },
        { key: 'sessionsMonth', value: sessions.length, tone: 'good' },
        { key: 'almostDone', value: almostDone.length, tone: almostDone.length ? 'warn' : 'good', patients: almostDone.slice(0, 10).map(p => who(p, `${count.get(p.id) || 0} / ${p.data.sessionsPrescribed} séances`)) },
      ];
    }
    case 'PSYCHIATRY': {
      const scales = await records(prisma, scope, ['PSY_SCALE'], yearAgo);
      const followed = new Set(scales.map(s => s.patientId)).size;
      const latestPhq = latestByPatient(scales.filter(s => s.data.scale === 'PHQ9'));
      const severe = latestPhq.filter(r => r.data.score >= 20);
      return [
        { key: 'followed', value: followed },
        { key: 'scalesMonth', value: scales.filter(s => s.date >= monthStart).length },
        { key: 'severeDepression', value: severe.length, tone: severe.length ? 'bad' : 'good', patients: severe.slice(0, 10).map(r => who(r, `PHQ-9 ${r.data.score}`)) },
      ];
    }
    case 'DENTISTRY': {
      const where = { cabinetId: scope.cabinetId, ...(scope.practitionerId ? { practitionerId: scope.practitionerId } : {}) };
      const [actsMonth, plannedActs, openPlans, quotes] = await Promise.all([
        prisma.dentalAct.count({ where: { ...where, status: 'DONE', performedAt: { gte: monthStart } } }),
        prisma.dentalAct.count({ where: { ...where, status: 'PLANNED' } }),
        prisma.treatmentPlan.count({ where: { ...where, status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS'] } } }),
        prisma.quote.groupBy({ by: ['status'], where: { cabinetId: scope.cabinetId, createdAt: { gte: yearAgo } }, _count: true }),
      ]);
      const sent = quotes.filter(q => q.status !== 'DRAFT').reduce((s, q) => s + q._count, 0);
      const accepted = quotes.filter(q => q.status === 'ACCEPTED').reduce((s, q) => s + q._count, 0);
      return [
        { key: 'actsMonth', value: actsMonth, tone: 'good' },
        { key: 'plannedActs', value: plannedActs },
        { key: 'openPlans', value: openPlans },
        { key: 'quoteAcceptance', value: sent ? Math.round((accepted / sent) * 100) : 0, tone: sent && accepted / sent < 0.4 ? 'warn' : 'good' },
      ];
    }
    default:
      return [];
  }
}
