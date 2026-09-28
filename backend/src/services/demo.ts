import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { DENTAL_ACTS, GENERAL_ACTS } from '../data/catalogue';

/**
 * Demo cabinet filled with fictitious patients (F-SA-03), for sales demos, training and support.
 * Dates are relative to the day it is built, so it is rebuilt every day (see startDemoRefreshJob):
 * a demo opened any morning shows a full day, a waiting room, unpaid invoices and treatment plans.
 */

const DEMO_PASSWORD = 'Demo1234!';
export const DEMO_ACCOUNTS = ['demo.dentiste@cabinetpro.ma', 'demo.generaliste@cabinetpro.ma', 'demo.assistant@cabinetpro.ma'];

/** Removes a cabinet and its data in dependency order (some relations are RESTRICT on purpose). */
async function wipeCabinet(cabinetId: string) {
  await prisma.payment.deleteMany({ where: { cabinetId } });
  await prisma.quote.deleteMany({ where: { cabinetId } });
  await prisma.invoice.deleteMany({ where: { cabinetId } });
  await prisma.dentalAct.deleteMany({ where: { cabinetId } });
  await prisma.treatmentPlan.deleteMany({ where: { cabinetId } });
  await prisma.consultation.deleteMany({ where: { cabinetId } });
  await prisma.prescription.deleteMany({ where: { cabinetId } });
  await prisma.patient.deleteMany({ where: { cabinetId } });
  await prisma.user.deleteMany({ where: { cabinetId } });
  await prisma.message.deleteMany({ where: { cabinetId } });
  await prisma.cabinet.delete({ where: { id: cabinetId } });
}

const at = (daysFromToday: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const yearsAgo = (years: number, months = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - months);
  return d;
};
const isWeekend = (d: Date) => d.getDay() === 0;

// Deterministic pseudo-random numbers: the demo looks the same every day, only the dates move.
function random(seed = 42) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

// For PRIVATE / MUTUELLE coverage, `complementary` is the insurer's name (as in the patient form).
type P = { firstName: string; lastName: string; sex: 'F' | 'M'; age: number; months?: number; coverage: string; coverageNumber?: string; complementary?: string; insuredName?: string; phone: string; cin?: string; allergies?: string; medicalHistory?: string; currentTreatments?: string; general?: boolean };

const PEOPLE: P[] = [
  { firstName: 'Karim', lastName: 'El Amrani', sex: 'M', age: 42, coverage: 'CNOPS', coverageNumber: '1234567', complementary: 'MGPAP', phone: '0611111111', cin: 'BE123456', allergies: 'Pénicilline', medicalHistory: 'Hypertension artérielle traitée', currentTreatments: 'Amlodipine 5 mg' },
  { firstName: 'Lina', lastName: 'Tazi', sex: 'F', age: 4, months: 3, coverage: 'CNSS', coverageNumber: '154879632', insuredName: 'Mehdi Tazi (père)', phone: '0622222222' },
  { firstName: 'Adam', lastName: 'Berrada', sex: 'M', age: 8, months: 2, coverage: 'PRIVATE', complementary: 'Wafa Assurance', coverageNumber: 'WA-778812', insuredName: 'Sara Berrada (mère)', phone: '0633333333' },
  { firstName: 'Fatima Zahra', lastName: 'Chraibi', sex: 'F', age: 31, coverage: 'CNSS', coverageNumber: '198765432', complementary: 'AXA Assurance Maroc', phone: '0644444444', cin: 'BK998877' },
  { firstName: 'Mohamed', lastName: 'Ouazzani', sex: 'M', age: 67, coverage: 'CNOPS', phone: '0655555555', medicalHistory: 'Diabète de type 2', currentTreatments: 'Metformine 850 mg' },
  { firstName: 'Salma', lastName: 'Kettani', sex: 'F', age: 25, coverage: 'AMO_TADAMON', phone: '0666666666' },
  { firstName: 'Hicham', lastName: 'Benjelloun', sex: 'M', age: 55, coverage: 'CNSS', phone: '0677777777', medicalHistory: 'Diabète de type 2, dyslipidémie', general: true },
  { firstName: 'Nora', lastName: 'Lahlou', sex: 'F', age: 38, coverage: 'MUTUELLE', phone: '0661234501', allergies: 'Latex' },
  { firstName: 'Youssef', lastName: 'Sqalli', sex: 'M', age: 29, coverage: 'CNSS', phone: '0661234502' },
  { firstName: 'Imane', lastName: 'Fassi Fihri', sex: 'F', age: 46, coverage: 'CNOPS', phone: '0661234503', medicalHistory: 'Asthme' },
  { firstName: 'Omar', lastName: 'Bennis', sex: 'M', age: 12, coverage: 'FAR', insuredName: 'Karim Bennis (père)', phone: '0661234504' },
  { firstName: 'Rania', lastName: 'Alami', sex: 'F', age: 34, coverage: 'CNSS', phone: '0661234505', general: true },
  { firstName: 'Mehdi', lastName: 'Cherkaoui', sex: 'M', age: 51, coverage: 'MUTUELLE', phone: '0661234506', medicalHistory: 'Anticoagulants (AVK)', currentTreatments: 'Sintrom' },
  { firstName: 'Khadija', lastName: 'Naciri', sex: 'F', age: 72, coverage: 'CNOPS', phone: '0661234507', medicalHistory: 'Hypertension', general: true },
  { firstName: 'Anas', lastName: 'Belkadi', sex: 'M', age: 19, coverage: 'NONE', phone: '0661234508' },
  { firstName: 'Soukaina', lastName: 'Hajji', sex: 'F', age: 27, coverage: 'CNSS', phone: '0661234509' },
  { firstName: 'Reda', lastName: 'Mansouri', sex: 'M', age: 60, coverage: 'CNOPS', phone: '0661234510', general: true },
  { firstName: 'Ghita', lastName: 'Skalli', sex: 'F', age: 9, coverage: 'MUTUELLE', phone: '0661234511' },
  { firstName: 'Tarik', lastName: 'Zniber', sex: 'M', age: 44, coverage: 'CNSS', phone: '0661234512', allergies: 'Aspirine' },
  { firstName: 'Houda', lastName: 'Berrechid', sex: 'F', age: 36, coverage: 'CNSS', phone: '0661234513', general: true },
  { firstName: 'Saad', lastName: 'Guessous', sex: 'M', age: 23, coverage: 'NONE', phone: '0661234514' },
  { firstName: 'Meriem', lastName: 'Tahiri', sex: 'F', age: 58, coverage: 'CNOPS', phone: '0661234515' },
];

export async function resetDemoCabinet() {
  const existing = await prisma.cabinet.findMany({ where: { isDemo: true } });
  for (const cabinet of existing) await wipeCabinet(cabinet.id);
  // Demo accounts must not survive under another cabinet either.
  await prisma.user.deleteMany({ where: { email: { in: DEMO_ACCOUNTS } } });

  const rnd = random();
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const password = await bcrypt.hash(DEMO_PASSWORD, 12);

  const cabinet = await prisma.cabinet.create({
    data: {
      name: 'Cabinet de démonstration', specialty: 'DENTISTRY', isDemo: true, city: 'Casablanca', address: '12, boulevard d’Anfa',
      phone: '0522000000', email: 'demo@cabinetpro.ma', plan: 'CLINIQUE', subscriptionStatus: 'ACTIVE',
      maxPractitioners: 10, maxAssistants: 999, monthlyMessages: 2000,
      letterhead: 'Dr Salma Bennani — Chirurgien-dentiste\nDiplômée de la Faculté de médecine dentaire de Casablanca\nINPE : 000000000',
    },
  });
  const cabinetId = cabinet.id;

  const dentist = await prisma.user.create({ data: { email: DEMO_ACCOUNTS[0], password, title: 'Dr', firstName: 'Salma', lastName: 'Bennani', phone: '0600000001', role: 'OWNER', specialty: 'DENTISTRY', seesAllPatients: true, cabinetId } });
  const generalist = await prisma.user.create({ data: { email: DEMO_ACCOUNTS[1], password, title: 'Dr', firstName: 'Youssef', lastName: 'Alaoui', phone: '0600000002', role: 'PRACTITIONER', specialty: 'GENERAL', cabinetId } });
  const assistant = await prisma.user.create({ data: { email: DEMO_ACCOUNTS[2], password, firstName: 'Nadia', lastName: 'Idrissi', phone: '0600000003', role: 'ASSISTANT', cabinetId } });

  const catalogue = [...DENTAL_ACTS.map(a => ({ ...a, specialty: 'DENTISTRY' })), ...GENERAL_ACTS.map(a => ({ ...a, specialty: 'GENERAL', code: `G-${a.code}` }))];
  await prisma.act.createMany({ data: catalogue.map(a => ({ cabinetId, specialty: a.specialty, code: a.code, name: a.name, price: a.price, category: a.category, scope: a.scope, usesFaces: !!a.usesFaces, resultingState: a.resultingState || null })) });
  const acts = new Map((await prisma.act.findMany({ where: { cabinetId } })).map(a => [a.code, a]));
  const act = (code: string) => acts.get(code)!;

  const consent = { consentDataAt: at(-90, 10), consentRemindersAt: at(-90, 10) };
  const patients: Awaited<ReturnType<typeof prisma.patient.create>>[] = [];
  for (const p of PEOPLE) {
    patients.push(await prisma.patient.create({
      data: {
        cabinetId, primaryPractitionerId: p.general ? generalist.id : dentist.id, ...consent,
        firstName: p.firstName, lastName: p.lastName, sex: p.sex, birthDate: yearsAgo(p.age, p.months || 0), phone: p.phone, cin: p.cin || null,
        coverage: p.coverage, coverageNumber: p.coverageNumber || null, complementaryInsurance: p.complementary || null, insuredName: p.insuredName || null, allergies: p.allergies || null, medicalHistory: p.medicalHistory || null, currentTreatments: p.currentTreatments || null,
        address: 'Casablanca',
      },
    }));
  }
  const byName = (firstName: string) => patients.find(p => p.firstName === firstName)!;
  const [karim, lina, adam, fatima, mohamed, salma, hicham] = ['Karim', 'Lina', 'Adam', 'Fatima Zahra', 'Mohamed', 'Salma', 'Hicham'].map(byName);
  const dentalPatients = patients.filter((_, i) => !PEOPLE[i].general && PEOPLE[i].age >= 12);
  const generalPatients = patients.filter((_, i) => PEOPLE[i].general);

  // ─── Tooth charts ───
  const karimStates: [number, string, string | null][] = [
    [17, 'CROWN', null], [16, 'CROWN', null], [14, 'FILLED', 'O'], [21, 'ENDO', null], [26, 'FILLED', 'M,O'],
    [28, 'MISSING', null], [48, 'MISSING', null], [46, 'MISSING', null], [35, 'CARIES', 'D'], [36, 'CARIES', 'M,O,D'],
  ];
  const charts: { patientId: string; tooth: number; state: string; faces: string | null }[] = karimStates.map(([tooth, state, faces]) => ({ patientId: karim.id, tooth, state, faces }));
  charts.push({ patientId: lina.id, tooth: 64, state: 'CARIES', faces: 'O' }, { patientId: lina.id, tooth: 85, state: 'FILLED', faces: 'O' });
  charts.push({ patientId: adam.id, tooth: 36, state: 'ERUPTING', faces: null }, { patientId: adam.id, tooth: 75, state: 'MOBILE', faces: null });
  const adultTeeth = [14, 15, 16, 17, 24, 25, 26, 27, 34, 35, 36, 37, 44, 45, 46, 47, 18, 28, 38, 48];
  const commonStates: [string, string | null][] = [['FILLED', 'O'], ['FILLED', 'M,O'], ['CARIES', 'O'], ['CROWN', null], ['ENDO', null], ['MISSING', null]];
  for (const p of dentalPatients) {
    if ([karim.id, fatima.id].includes(p.id)) continue;
    const used = new Set<number>();
    for (let i = 0, n = Math.floor(rnd() * 5); i < n; i++) {
      const tooth = pick(adultTeeth);
      if (used.has(tooth)) continue;
      used.add(tooth);
      const [state, faces] = tooth % 10 === 8 ? ['MISSING', null] : pick(commonStates);
      charts.push({ patientId: p.id, tooth, state, faces });
    }
  }
  charts.push({ patientId: fatima.id, tooth: 46, state: 'CARIES', faces: 'O,D' }, { patientId: fatima.id, tooth: 36, state: 'FILLED', faces: 'O' });
  await prisma.toothState.createMany({ data: charts.map(c => ({ cabinetId, ...c, updatedById: dentist.id })) });

  // ─── Invoices, numbered in date order ───
  let invoiceSeq = 0;
  let quoteSeq = 0;
  const year = new Date().getFullYear();
  const invoice = async (patientId: string, practitionerId: string, date: Date, codes: { code: string; teeth?: string; faces?: string }[], paid: 'ALL' | 'NONE' | number, method = 'CASH') => {
    const lines = codes.map(c => ({ ...c, a: act(c.code) }));
    const total = lines.reduce((s, l) => s + Number(l.a.price), 0);
    const amountPaid = paid === 'ALL' ? total : paid === 'NONE' ? 0 : paid;
    const created = await prisma.invoice.create({
      data: {
        cabinetId, patientId, practitionerId, number: `F-${year}-${String(++invoiceSeq).padStart(5, '0')}`, date, total, paid: amountPaid,
        status: amountPaid >= total ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'OPEN',
        items: { create: lines.map(l => ({ actId: l.a.id, code: l.a.code, label: l.a.name, teeth: l.teeth || null, faces: l.faces || null, unitPrice: l.a.price, total: l.a.price })) },
      },
    });
    if (amountPaid > 0) {
      const paidAt = new Date(date.getTime() + 25 * 60_000);
      await prisma.payment.create({ data: { cabinetId, patientId, invoiceId: created.id, method, amount: amountPaid, paidAt, receivedById: assistant.id } });
    }
    return created;
  };

  // ─── The last 30 days: mostly done visits, a few absences, each visit invoiced ───
  const dentalVisits = [['CONS'], ['DET'], ['OBT1'], ['OBT2'], ['CONS', 'RADR'], ['EXT'], ['END1']];
  const generalVisits = [['G-CONS'], ['G-CTRL'], ['G-CONS', 'G-GLY'], ['G-CONS', 'G-ECG']];
  for (let day = -30; day <= -1; day++) {
    if (isWeekend(at(day, 9))) continue;
    const slots = [9, 10, 11, 14.5, 16];
    for (const hour of slots) {
      if (rnd() < 0.25) continue;
      const general = rnd() < 0.3;
      const patient = pick(general ? generalPatients : dentalPatients);
      const practitioner = general ? generalist : dentist;
      const date = at(day, Math.floor(hour), (hour % 1) * 60);
      const absent = rnd() < 0.08;
      const codes = pick(general ? generalVisits : dentalVisits);
      await prisma.appointment.create({
        data: {
          cabinetId, patientId: patient.id, practitionerId: practitioner.id, date, durationMinutes: 30, reason: act(codes[0]).name,
          status: absent ? 'NO_SHOW' : 'DONE', arrivedAt: absent ? null : new Date(date.getTime() - 8 * 60_000), startedAt: absent ? null : date,
          completedAt: absent ? null : new Date(date.getTime() + 25 * 60_000),
        },
      });
      if (absent) continue;
      const teeth = codes.some(c => act(c).scope === 'TOOTH') ? String(pick(adultTeeth.filter(t => t % 10 !== 8))) : undefined;
      // A few recent visits are still unpaid or partly paid: they fill the "À encaisser" list.
      const unpaid = day >= -6 && rnd() < 0.25;
      const total = codes.reduce((s, c) => s + Number(act(c).price), 0);
      await invoice(patient.id, practitioner.id, new Date(date.getTime() + 25 * 60_000), codes.map(code => ({ code, teeth: act(code).scope === 'TOOTH' ? teeth : undefined })), unpaid ? (rnd() < 0.5 ? 'NONE' : Math.round(total / 2)) : 'ALL', pick(['CASH', 'CASH', 'CARD', 'TRANSFER']));
    }
  }

  // ─── Karim: the adult chart of the specification, a paid past invoice and an accepted plan ───
  const [det, obt, ccm, imp] = ['DET', 'OBT1', 'CCM', 'IMP'].map(act);
  for (const p of [{ a: det, teeth: null, faces: null, days: -60 }, { a: obt, teeth: '14', faces: 'O', days: -60 }, { a: obt, teeth: '26', faces: 'M,O', days: -30 }]) {
    await prisma.dentalAct.create({ data: { cabinetId, patientId: karim.id, practitionerId: dentist.id, actId: p.a.id, code: p.a.code, label: p.a.name, scope: p.a.scope, teeth: p.teeth, faces: p.faces, price: p.a.price, resultingState: p.a.resultingState, status: 'DONE', performedAt: at(p.days, 10) } });
  }
  const plan = await prisma.treatmentPlan.create({ data: { cabinetId, patientId: karim.id, practitionerId: dentist.id, title: 'Réhabilitation secteurs 2 et 4', status: 'ACCEPTED', notes: 'Commencer par le traitement des caries.' } });
  const planned = [
    { a: act('OBT2'), teeth: '35', faces: 'D', session: 1 },
    { a: act('OBT3'), teeth: '36', faces: 'M,O,D', session: 1 },
    { a: ccm, teeth: '21', faces: null, session: 2 },
    { a: imp, teeth: '46', faces: null, session: 3 },
  ];
  for (const p of planned) {
    await prisma.dentalAct.create({ data: { cabinetId, patientId: karim.id, practitionerId: dentist.id, treatmentPlanId: plan.id, actId: p.a.id, code: p.a.code, label: p.a.name, scope: p.a.scope, teeth: p.teeth, faces: p.faces, price: p.a.price, resultingState: p.a.resultingState, session: p.session } });
  }
  const quoteTotal = planned.reduce((s, p) => s + Number(p.a.price), 0);
  const installments = [0, 1, 2].map(i => {
    const d = at(0, 12);
    d.setMonth(d.getMonth() + i);
    return { dueDate: d.toISOString().slice(0, 10), amount: i < 2 ? Math.floor(quoteTotal / 3) : quoteTotal - 2 * Math.floor(quoteTotal / 3) };
  });
  const karimQuote = await prisma.quote.create({
    data: {
      cabinetId, patientId: karim.id, treatmentPlanId: plan.id, practitionerId: dentist.id, number: `D-${year}-${String(++quoteSeq).padStart(5, '0')}`, date: at(-7, 10),
      total: quoteTotal, status: 'ACCEPTED', acceptedAt: at(-7, 10), validUntil: at(23, 10), installments: JSON.stringify(installments),
      items: { create: planned.map(p => ({ actId: p.a.id, code: p.a.code, label: p.a.name, teeth: p.teeth, faces: p.faces, unitPrice: p.a.price, total: p.a.price })) },
    },
  });
  await prisma.payment.create({ data: { cabinetId, patientId: karim.id, quoteId: karimQuote.id, method: 'CASH', amount: installments[0].amount, paidAt: at(-7, 10, 30), receivedById: assistant.id } });

  // ─── Fatima Zahra: a plan proposed, quote waiting for her answer ───
  const fatimaPlan = await prisma.treatmentPlan.create({ data: { cabinetId, patientId: fatima.id, practitionerId: dentist.id, title: 'Traitement de la 46', status: 'PROPOSED' } });
  const fatimaActs = [{ a: act('END2'), teeth: '46', faces: null, session: 1 }, { a: act('CZR'), teeth: '46', faces: null, session: 2 }];
  for (const p of fatimaActs) {
    await prisma.dentalAct.create({ data: { cabinetId, patientId: fatima.id, practitionerId: dentist.id, treatmentPlanId: fatimaPlan.id, actId: p.a.id, code: p.a.code, label: p.a.name, scope: p.a.scope, teeth: p.teeth, faces: p.faces, price: p.a.price, resultingState: p.a.resultingState, session: p.session } });
  }
  await prisma.quote.create({
    data: {
      cabinetId, patientId: fatima.id, treatmentPlanId: fatimaPlan.id, practitionerId: dentist.id, number: `D-${year}-${String(++quoteSeq).padStart(5, '0')}`, date: at(-2, 11),
      total: fatimaActs.reduce((s, p) => s + Number(p.a.price), 0), status: 'SENT', validUntil: at(28, 11),
      items: { create: fatimaActs.map(p => ({ actId: p.a.id, code: p.a.code, label: p.a.name, teeth: p.teeth, faces: p.faces, unitPrice: p.a.price, total: p.a.price })) },
    },
  });

  // ─── Consultation history ───
  await prisma.consultation.create({ data: { cabinetId, patientId: karim.id, practitionerId: dentist.id, specialty: 'DENTISTRY', date: at(-7, 10), reason: 'Douleur au froid secteur 3', examination: 'Carie distale 35, carie MOD 36. 46 absente depuis 2019.', diagnosis: 'Caries 35 et 36', plan: 'Obturations 35 et 36, couronne 21, implant 46', status: 'LOCKED', lockedAt: at(-7, 10, 40) } });
  await prisma.prescription.create({ data: { cabinetId, patientId: karim.id, practitionerId: dentist.id, date: at(-7, 10, 40), items: JSON.stringify([{ drug: 'Paracétamol 1 g', dosage: '1 comprimé 3 fois par jour si douleur', duration: '5 jours' }, { drug: 'Chlorhexidine 0,12 % bain de bouche', dosage: '2 bains de bouche par jour', duration: '7 jours' }]) } });
  await prisma.consultation.create({ data: { cabinetId, patientId: hicham.id, practitionerId: generalist.id, specialty: 'GENERAL', date: at(-14, 16), reason: 'Suivi diabète', vitals: JSON.stringify({ systolic: 135, diastolic: 85, weight: 88, height: 176, glucose: 1.42 }), diagnosis: 'Diabète de type 2 équilibré', plan: 'HbA1c dans 3 mois', status: 'LOCKED', lockedAt: at(-14, 16, 30) } });

  // ─── Today: a morning in progress for both doctors ───
  const [nora, youssef, imane, mehdi, rania, khadija, reda] = ['Nora', 'Youssef', 'Imane', 'Mehdi', 'Rania', 'Khadija', 'Reda'].map(byName);
  const today: { p: typeof karim; u: typeof dentist; h: number; m: number; dur: number; reason: string; status: string; arrived?: [number, number]; walkIn?: boolean; bill?: { codes: string[]; paid: 'ALL' | 'NONE'; method?: string } }[] = [
    { p: youssef, u: dentist, h: 8, m: 30, dur: 30, reason: 'Contrôle', status: 'NO_SHOW' },
    { p: mohamed, u: dentist, h: 9, m: 0, dur: 30, reason: 'Détartrage', status: 'DONE', arrived: [8, 52], bill: { codes: ['DET'], paid: 'ALL', method: 'CASH' } },
    { p: salma, u: dentist, h: 9, m: 30, dur: 30, reason: 'Obturation 26', status: 'DONE', arrived: [9, 24], bill: { codes: ['OBT1'], paid: 'NONE' } },
    { p: karim, u: dentist, h: 10, m: 0, dur: 45, reason: 'Obturations 35 et 36', status: 'IN_CONSULTATION', arrived: [9, 55] },
    { p: lina, u: dentist, h: 10, m: 45, dur: 30, reason: 'Contrôle', status: 'ARRIVED', arrived: [10, 30] },
    { p: nora, u: dentist, h: 10, m: 40, dur: 20, reason: 'Douleur dent de sagesse', status: 'ARRIVED', arrived: [10, 40], walkIn: true },
    { p: adam, u: dentist, h: 11, m: 30, dur: 30, reason: 'Première visite', status: 'CONFIRMED' },
    { p: fatima, u: dentist, h: 12, m: 0, dur: 30, reason: 'Réponse au devis', status: 'CONFIRMED' },
    { p: imane, u: dentist, h: 14, m: 30, dur: 60, reason: 'Traitement canalaire', status: 'PLANNED' },
    { p: mehdi, u: dentist, h: 16, m: 0, dur: 30, reason: 'Extraction', status: 'PLANNED' },
    { p: hicham, u: generalist, h: 9, m: 0, dur: 20, reason: 'Suivi diabète', status: 'DONE', arrived: [8, 50], bill: { codes: ['G-CONS', 'G-GLY'], paid: 'ALL', method: 'CARD' } },
    { p: rania, u: generalist, h: 10, m: 30, dur: 20, reason: 'Fièvre', status: 'ARRIVED', arrived: [10, 25] },
    { p: khadija, u: generalist, h: 11, m: 0, dur: 20, reason: 'Tension artérielle', status: 'CONFIRMED' },
    { p: reda, u: generalist, h: 15, m: 0, dur: 20, reason: 'Contrôle', status: 'PLANNED' },
  ];
  for (const a of today) {
    const date = at(0, a.h, a.m);
    await prisma.appointment.create({
      data: {
        cabinetId, patientId: a.p.id, practitionerId: a.u.id, date, durationMinutes: a.dur, reason: a.reason, status: a.status, walkIn: !!a.walkIn,
        arrivedAt: a.arrived ? at(0, a.arrived[0], a.arrived[1]) : null,
        startedAt: ['IN_CONSULTATION', 'DONE'].includes(a.status) ? date : null,
        completedAt: a.status === 'DONE' ? new Date(date.getTime() + 25 * 60_000) : null,
      },
    });
    if (a.bill) await invoice(a.p.id, a.u.id, new Date(date.getTime() + 25 * 60_000), a.bill.codes.map(code => ({ code })), a.bill.paid, a.bill.method);
  }

  // ─── The coming week ───
  for (let day = 1; day <= 7; day++) {
    if (isWeekend(at(day, 9))) continue;
    for (const hour of [9, 10.5, 14.5, 16]) {
      if (rnd() < 0.35) continue;
      const general = rnd() < 0.3;
      const patient = pick(general ? generalPatients : dentalPatients);
      await prisma.appointment.create({
        data: {
          cabinetId, patientId: patient.id, practitionerId: (general ? generalist : dentist).id, date: at(day, Math.floor(hour), (hour % 1) * 60),
          durationMinutes: 30, reason: pick(general ? ['Consultation', 'Contrôle', 'Suivi tension'] : ['Contrôle', 'Détartrage', 'Obturation', 'Consultation']),
          status: day <= 2 ? 'CONFIRMED' : 'PLANNED',
        },
      });
    }
  }
  await prisma.appointment.create({ data: { cabinetId, patientId: karim.id, practitionerId: dentist.id, date: at(14, 9), durationMinutes: 60, reason: 'Préparation couronne 21', status: 'PLANNED' } });

  await prisma.cabinet.update({ where: { id: cabinetId }, data: { invoiceSeq, quoteSeq } });
  return cabinet;
}

/** Rebuilds the demo when it was built on an earlier day, so its agenda always shows "today". */
export async function refreshDemoIfStale() {
  const demo = await prisma.cabinet.findFirst({ where: { isDemo: true }, select: { createdAt: true } });
  if (!demo) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (demo.createdAt >= startOfToday) return false;
  await resetDemoCabinet();
  return true;
}

/** Checks at start-up and then every hour; the rebuild itself happens once a day. */
export function startDemoRefreshJob() {
  if (process.env.DEMO_AUTO_REFRESH === 'false') return;
  const run = () => refreshDemoIfStale()
    .then(done => { if (done) console.log('🔄 Cabinet de démonstration remis à la date du jour'); })
    .catch(err => console.error('[demo] refresh failed:', err?.message || err));
  void run();
  setInterval(run, 60 * 60 * 1000).unref();
}
