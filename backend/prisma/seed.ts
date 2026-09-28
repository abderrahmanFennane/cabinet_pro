import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const hash = (password: string) => bcrypt.hash(password, 12);

const ALL_FEATURES = [
  'MANAGE_PATIENTS', 'VIEW_MEDICAL', 'MANAGE_APPOINTMENTS', 'MANAGE_CONSULTATIONS', 'MANAGE_PRESCRIPTIONS', 'PRINT_DOCUMENTS',
  'MANAGE_BILLING', 'VIEW_REPORTS', 'ADVANCED_STATS', 'DENTAL_CHART', 'DENTAL_TREATMENT_PLAN', 'MANAGE_TEAM', 'MANAGE_SETTINGS',
  'MANAGE_SUBSCRIPTION', 'MULTI_SPECIALTY',
];
const without = (...keys: string[]) => ALL_FEATURES.filter(key => !keys.includes(key));

// Section 09 of the specification. Prices are placeholders until the commercial offer is decided.
const PLANS = [
  { code: 'TRIAL', name: 'Essai', description: 'Essai gratuit de 3 jours, toutes fonctions', monthlyPrice: 0, durationMonths: 1, maxPractitioners: 1, maxAssistants: 1, monthlyMessages: 20, storageGb: 1, permissions: without('MULTI_SPECIALTY') },
  { code: 'ESSENTIEL', name: 'Essentiel', description: 'Un praticien, l’essentiel du cabinet', monthlyPrice: 299, durationMonths: 1, maxPractitioners: 1, maxAssistants: 1, monthlyMessages: 100, storageGb: 5, permissions: without('DENTAL_TREATMENT_PLAN', 'ADVANCED_STATS', 'MULTI_SPECIALTY') },
  { code: 'PRO', name: 'Pro', description: 'Plans de traitement, devis et statistiques avancées', monthlyPrice: 499, durationMonths: 1, maxPractitioners: 1, maxAssistants: 3, monthlyMessages: 500, storageGb: 50, permissions: without('MULTI_SPECIALTY') },
  { code: 'CLINIQUE', name: 'Clinique', description: 'Jusqu’à 10 praticiens et plusieurs spécialités', monthlyPrice: 1490, durationMonths: 1, maxPractitioners: 10, maxAssistants: 999, monthlyMessages: 2000, storageGb: 200, permissions: ALL_FEATURES },
];

const SPECIALTIES = [
  { code: 'DENTISTRY', name: 'Médecine dentaire', isActive: true, sortOrder: 1 },
  { code: 'GENERAL', name: 'Médecine générale', isActive: true, sortOrder: 2 },
  { code: 'PEDIATRICS', name: 'Pédiatrie', isActive: false, sortOrder: 3 },
  { code: 'GYNECOLOGY', name: 'Gynécologie-obstétrique', isActive: false, sortOrder: 4 },
  { code: 'OPHTHALMOLOGY', name: 'Ophtalmologie', isActive: false, sortOrder: 5 },
  { code: 'CARDIOLOGY', name: 'Cardiologie', isActive: false, sortOrder: 6 },
  { code: 'DERMATOLOGY', name: 'Dermatologie', isActive: false, sortOrder: 7 },
  { code: 'PHYSIOTHERAPY', name: 'Kinésithérapie', isActive: false, sortOrder: 8 },
  { code: 'PSYCHIATRY', name: 'Psychiatrie / psychologie', isActive: false, sortOrder: 9 },
];

type SeedAct = { code: string; name: string; price: number; category: string; scope: string; usesFaces?: boolean; resultingState?: string };

// Indicative prices in MAD; the nomenclature is still to be confirmed with the ANAM (spec section 14).
const DENTAL_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation et bilan bucco-dentaire', price: 200, category: 'Diagnostic', scope: 'NONE' },
  { code: 'RADR', name: 'Radio rétro-alvéolaire', price: 100, category: 'Diagnostic', scope: 'TOOTH' },
  { code: 'PANO', name: 'Radio panoramique', price: 300, category: 'Diagnostic', scope: 'MOUTH' },
  { code: 'DET', name: 'Détartrage et polissage', price: 400, category: 'Prévention', scope: 'MOUTH' },
  { code: 'SCEL', name: 'Scellement de sillons', price: 200, category: 'Prévention', scope: 'TOOTH' },
  { code: 'OBT1', name: 'Obturation composite 1 face', price: 400, category: 'Soins', scope: 'TOOTH', usesFaces: true, resultingState: 'FILLED' },
  { code: 'OBT2', name: 'Obturation composite 2 faces', price: 500, category: 'Soins', scope: 'TOOTH', usesFaces: true, resultingState: 'FILLED' },
  { code: 'OBT3', name: 'Obturation composite 3 faces (MOD)', price: 600, category: 'Soins', scope: 'TOOTH', usesFaces: true, resultingState: 'FILLED' },
  { code: 'END1', name: 'Traitement canalaire monoradiculée', price: 1200, category: 'Endodontie', scope: 'TOOTH', resultingState: 'ENDO' },
  { code: 'END2', name: 'Traitement canalaire pluriradiculée', price: 2000, category: 'Endodontie', scope: 'TOOTH', resultingState: 'ENDO' },
  { code: 'EXT', name: 'Extraction simple', price: 300, category: 'Chirurgie', scope: 'TOOTH', resultingState: 'MISSING' },
  { code: 'EXTC', name: 'Extraction chirurgicale / dent de sagesse', price: 800, category: 'Chirurgie', scope: 'TOOTH', resultingState: 'MISSING' },
  { code: 'IMP', name: 'Implant (pose)', price: 8000, category: 'Implantologie', scope: 'TOOTH', resultingState: 'IMPLANT' },
  { code: 'CCM', name: 'Couronne céramo-métallique', price: 2500, category: 'Prothèse', scope: 'TOOTH', resultingState: 'CROWN' },
  { code: 'CZR', name: 'Couronne zircone', price: 4000, category: 'Prothèse', scope: 'TOOTH', resultingState: 'CROWN' },
  { code: 'BRG3', name: 'Bridge 3 éléments', price: 7500, category: 'Prothèse', scope: 'TEETH', resultingState: 'BRIDGE' },
  { code: 'PAP', name: 'Prothèse amovible partielle', price: 3500, category: 'Prothèse', scope: 'TEETH' },
  { code: 'BLAN', name: 'Blanchiment', price: 2500, category: 'Esthétique', scope: 'MOUTH' },
  { code: 'ORTC', name: 'Consultation orthodontique', price: 300, category: 'Orthodontie', scope: 'NONE' },
];

const GENERAL_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation', price: 250, category: 'Consultation', scope: 'NONE' },
  { code: 'CTRL', name: 'Consultation de contrôle', price: 150, category: 'Consultation', scope: 'NONE' },
  { code: 'ECG', name: 'Électrocardiogramme', price: 200, category: 'Examens', scope: 'NONE' },
  { code: 'GLY', name: 'Glycémie capillaire', price: 50, category: 'Examens', scope: 'NONE' },
  { code: 'PANS', name: 'Pansement', price: 100, category: 'Soins', scope: 'NONE' },
  { code: 'INJ', name: 'Injection', price: 80, category: 'Soins', scope: 'NONE' },
];

async function seedCatalogue() {
  for (const specialty of SPECIALTIES) {
    await prisma.specialty.upsert({ where: { code: specialty.code }, update: { name: specialty.name, sortOrder: specialty.sortOrder }, create: specialty });
  }
  for (const plan of PLANS) {
    const data = { ...plan, permissions: JSON.stringify(plan.permissions) };
    await prisma.plan.upsert({ where: { code: plan.code }, update: data, create: data });
  }
  const acts = [...DENTAL_ACTS.map(a => ({ ...a, specialty: 'DENTISTRY' })), ...GENERAL_ACTS.map(a => ({ ...a, specialty: 'GENERAL' }))];
  for (const act of acts) {
    await prisma.defaultAct.upsert({
      where: { specialty_code: { specialty: act.specialty, code: act.code } },
      update: { name: act.name, price: act.price, category: act.category, scope: act.scope, usesFaces: !!act.usesFaces, resultingState: act.resultingState || null },
      create: { specialty: act.specialty, code: act.code, name: act.name, price: act.price, category: act.category, scope: act.scope, usesFaces: !!act.usesFaces, resultingState: act.resultingState || null },
    });
  }
}

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

/** Demo cabinet filled with fictitious patients (F-SA-03): used for sales demos and support, never real data. */
async function seedDemoCabinet() {
  const existing = await prisma.cabinet.findMany({ where: { isDemo: true } });
  for (const cabinet of existing) await wipeCabinet(cabinet.id);

  const password = await hash('Demo1234!');
  const cabinet = await prisma.cabinet.create({
    data: {
      name: 'Cabinet de démonstration', specialty: 'DENTISTRY', isDemo: true, city: 'Casablanca', address: '12, boulevard d’Anfa',
      phone: '0522000000', email: 'demo@cabinetpro.ma', plan: 'CLINIQUE', subscriptionStatus: 'ACTIVE',
      maxPractitioners: 10, maxAssistants: 999, monthlyMessages: 2000,
      letterhead: 'Dr Salma Bennani — Chirurgien-dentiste\nDiplômée de la Faculté de médecine dentaire de Casablanca\nINPE : 000000000',
      invoiceSeq: 0, quoteSeq: 0,
    },
  });

  const dentist = await prisma.user.create({ data: { email: 'demo.dentiste@cabinetpro.ma', password, title: 'Dr', firstName: 'Salma', lastName: 'Bennani', phone: '0600000001', role: 'OWNER', specialty: 'DENTISTRY', seesAllPatients: true, cabinetId: cabinet.id } });
  const generalist = await prisma.user.create({ data: { email: 'demo.generaliste@cabinetpro.ma', password, title: 'Dr', firstName: 'Youssef', lastName: 'Alaoui', phone: '0600000002', role: 'PRACTITIONER', specialty: 'GENERAL', cabinetId: cabinet.id } });
  await prisma.user.create({ data: { email: 'demo.assistant@cabinetpro.ma', password, firstName: 'Nadia', lastName: 'Idrissi', phone: '0600000003', role: 'ASSISTANT', cabinetId: cabinet.id } });

  const catalogue = [...DENTAL_ACTS.map(a => ({ ...a, specialty: 'DENTISTRY' })), ...GENERAL_ACTS.map(a => ({ ...a, specialty: 'GENERAL', code: `G-${a.code}` }))];
  await prisma.act.createMany({ data: catalogue.map(a => ({ cabinetId: cabinet.id, specialty: a.specialty, code: a.code, name: a.name, price: a.price, category: a.category, scope: a.scope, usesFaces: !!a.usesFaces, resultingState: a.resultingState || null })) });
  const act = async (code: string) => prisma.act.findFirstOrThrow({ where: { cabinetId: cabinet.id, code } });

  const consent = { consentDataAt: new Date(), consentRemindersAt: new Date() };
  const patient = (data: any) => prisma.patient.create({ data: { cabinetId: cabinet.id, primaryPractitionerId: dentist.id, ...consent, ...data } });

  const karim = await patient({ firstName: 'Karim', lastName: 'El Amrani', sex: 'M', birthDate: yearsAgo(42), cin: 'BE123456', phone: '0611111111', coverage: 'CNOPS', coverageNumber: '1234567', address: 'Maârif, Casablanca', bloodGroup: 'A+', allergies: 'Pénicilline', medicalHistory: 'Hypertension artérielle traitée', currentTreatments: 'Amlodipine 5 mg', surgicalHistory: 'Appendicectomie (2005)' });
  const lina = await patient({ firstName: 'Lina', lastName: 'Tazi', sex: 'F', birthDate: yearsAgo(4, 3), phone: '0622222222', coverage: 'AMO', coverageNumber: '7654321' });
  const adam = await patient({ firstName: 'Adam', lastName: 'Berrada', sex: 'M', birthDate: yearsAgo(8, 2), phone: '0633333333', coverage: 'MUTUELLE' });
  const others = await Promise.all([
    patient({ firstName: 'Fatima Zahra', lastName: 'Chraibi', sex: 'F', birthDate: yearsAgo(31), cin: 'BK998877', phone: '0644444444', coverage: 'AMO' }),
    patient({ firstName: 'Mohamed', lastName: 'Ouazzani', sex: 'M', birthDate: yearsAgo(67), phone: '0655555555', coverage: 'CNOPS', medicalHistory: 'Diabète de type 2', currentTreatments: 'Metformine 850 mg', allergies: '' }),
    patient({ firstName: 'Salma', lastName: 'Kettani', sex: 'F', birthDate: yearsAgo(25), phone: '0666666666', coverage: 'NONE' }),
    prisma.patient.create({ data: { cabinetId: cabinet.id, primaryPractitionerId: generalist.id, ...consent, firstName: 'Hicham', lastName: 'Benjelloun', sex: 'M', birthDate: yearsAgo(55), phone: '0677777777', coverage: 'AMO', medicalHistory: 'Diabète de type 2, dyslipidémie' } }),
  ]);

  // Karim: the adult chart of the specification (section 06).
  const states: [number, string, string | null][] = [
    [17, 'CROWN', null], [16, 'CROWN', null], [14, 'FILLED', 'O'], [21, 'ENDO', null], [26, 'FILLED', 'M,O'],
    [28, 'MISSING', null], [48, 'MISSING', null], [46, 'MISSING', null], [35, 'CARIES', 'D'], [36, 'CARIES', 'M,O,D'],
  ];
  await prisma.toothState.createMany({ data: states.map(([tooth, state, faces]) => ({ cabinetId: cabinet.id, patientId: karim.id, tooth, state, faces, updatedById: dentist.id })) });
  await prisma.toothState.createMany({ data: [
    { cabinetId: cabinet.id, patientId: lina.id, tooth: 64, state: 'CARIES', faces: 'O', updatedById: dentist.id },
    { cabinetId: cabinet.id, patientId: lina.id, tooth: 85, state: 'FILLED', faces: 'O', updatedById: dentist.id },
    { cabinetId: cabinet.id, patientId: adam.id, tooth: 36, state: 'ERUPTING', updatedById: dentist.id },
    { cabinetId: cabinet.id, patientId: adam.id, tooth: 75, state: 'MOBILE', updatedById: dentist.id },
  ] });

  // Past acts, already billed and paid.
  const [det, obt, ccm, imp] = await Promise.all(['DET', 'OBT1', 'CCM', 'IMP'].map(act));
  const past = [
    { a: det, teeth: null, faces: null, days: -60 },
    { a: obt, teeth: '14', faces: 'O', days: -60 },
    { a: obt, teeth: '26', faces: 'M,O', days: -30 },
  ];
  const invoice = await prisma.invoice.create({ data: { cabinetId: cabinet.id, patientId: karim.id, practitionerId: dentist.id, number: `F-${new Date().getFullYear()}-00001`, date: at(-30, 10), status: 'PAID' } });
  let invoiceTotal = 0;
  for (const p of past) {
    const dental = await prisma.dentalAct.create({ data: { cabinetId: cabinet.id, patientId: karim.id, practitionerId: dentist.id, actId: p.a.id, code: p.a.code, label: p.a.name, scope: p.a.scope, teeth: p.teeth, faces: p.faces, price: p.a.price, resultingState: p.a.resultingState, status: 'DONE', performedAt: at(p.days, 10) } });
    await prisma.invoiceItem.create({ data: { invoiceId: invoice.id, actId: p.a.id, dentalActId: dental.id, code: p.a.code, label: p.a.name, teeth: p.teeth, faces: p.faces, unitPrice: p.a.price, total: p.a.price } });
    invoiceTotal += Number(p.a.price);
  }
  await prisma.invoice.update({ where: { id: invoice.id }, data: { total: invoiceTotal, paid: invoiceTotal } });
  await prisma.payment.create({ data: { cabinetId: cabinet.id, patientId: karim.id, invoiceId: invoice.id, method: 'CARD', amount: invoiceTotal, paidAt: at(-30, 11), receivedById: dentist.id } });

  // Treatment plan with an accepted quote, a schedule and a first payment.
  const plan = await prisma.treatmentPlan.create({ data: { cabinetId: cabinet.id, patientId: karim.id, practitionerId: dentist.id, title: 'Réhabilitation secteur 2 et 4', status: 'ACCEPTED', notes: 'Commencer par le traitement des caries.' } });
  const planned = [
    { a: await act('OBT2'), teeth: '35', faces: 'D', session: 1 },
    { a: await act('OBT3'), teeth: '36', faces: 'M,O,D', session: 1 },
    { a: ccm, teeth: '21', faces: null, session: 2 },
    { a: imp, teeth: '46', faces: null, session: 3 },
  ];
  for (const p of planned) {
    await prisma.dentalAct.create({ data: { cabinetId: cabinet.id, patientId: karim.id, practitionerId: dentist.id, treatmentPlanId: plan.id, actId: p.a.id, code: p.a.code, label: p.a.name, scope: p.a.scope, teeth: p.teeth, faces: p.faces, price: p.a.price, resultingState: p.a.resultingState, session: p.session } });
  }
  const quoteTotal = planned.reduce((s, p) => s + Number(p.a.price), 0);
  const firstDue = at(0, 12);
  const installments = [0, 1, 2].map(i => {
    const d = new Date(firstDue);
    d.setMonth(d.getMonth() + i);
    return { dueDate: d.toISOString().slice(0, 10), amount: i < 2 ? Math.floor(quoteTotal / 3) : quoteTotal - 2 * Math.floor(quoteTotal / 3) };
  });
  const quote = await prisma.quote.create({
    data: {
      cabinetId: cabinet.id, patientId: karim.id, treatmentPlanId: plan.id, practitionerId: dentist.id, number: `D-${new Date().getFullYear()}-00001`,
      total: quoteTotal, status: 'ACCEPTED', acceptedAt: at(-7, 10), validUntil: at(23, 10), installments: JSON.stringify(installments),
      items: { create: planned.map(p => ({ actId: p.a.id, code: p.a.code, label: p.a.name, teeth: p.teeth, faces: p.faces, unitPrice: p.a.price, total: p.a.price })) },
    },
  });
  await prisma.payment.create({ data: { cabinetId: cabinet.id, patientId: karim.id, quoteId: quote.id, method: 'CASH', amount: installments[0].amount, paidAt: at(-7, 10, 30), receivedById: dentist.id } });
  await prisma.cabinet.update({ where: { id: cabinet.id }, data: { invoiceSeq: 1, quoteSeq: 1 } });

  // Consultation history.
  await prisma.consultation.create({ data: { cabinetId: cabinet.id, patientId: karim.id, practitionerId: dentist.id, specialty: 'DENTISTRY', date: at(-7, 10), reason: 'Douleur au froid secteur 3', examination: 'Carie distale 35, carie MOD 36. 46 absente depuis 2019.', diagnosis: 'Caries 35 et 36', plan: 'Obturations 35 et 36, couronne 21, implant 46', status: 'LOCKED', lockedAt: at(-7, 10, 40) } });
  await prisma.prescription.create({ data: { cabinetId: cabinet.id, patientId: karim.id, practitionerId: dentist.id, date: at(-7, 10, 40), items: JSON.stringify([{ drug: 'Paracétamol 1 g', dosage: '1 comprimé 3 fois par jour si douleur', duration: '5 jours' }, { drug: 'Chlorhexidine 0,12 % bain de bouche', dosage: '2 bains de bouche par jour', duration: '7 jours' }]) } });
  await prisma.consultation.create({ data: { cabinetId: cabinet.id, patientId: others[3].id, practitionerId: generalist.id, specialty: 'GENERAL', date: at(-14, 16), reason: 'Suivi diabète', vitals: JSON.stringify({ systolic: 135, diastolic: 85, weight: 88, height: 176, glucose: 1.42 }), diagnosis: 'Diabète de type 2 équilibré', plan: 'HbA1c dans 3 mois', status: 'LOCKED', lockedAt: at(-14, 16, 30) } });

  // Today's agenda and the coming days.
  const appointments = [
    { p: karim, u: dentist, d: at(0, 9), dur: 45, reason: 'Obturations 35 et 36', status: 'CONFIRMED' },
    { p: lina, u: dentist, d: at(0, 10), dur: 30, reason: 'Contrôle', status: 'ARRIVED', arrivedAt: at(0, 9, 50) },
    { p: adam, u: dentist, d: at(0, 11), dur: 30, reason: 'Première visite', status: 'PLANNED' },
    { p: others[0], u: dentist, d: at(0, 14, 30), dur: 30, reason: 'Détartrage', status: 'PLANNED' },
    { p: others[3], u: generalist, d: at(0, 15), dur: 20, reason: 'Suivi diabète', status: 'CONFIRMED' },
    { p: others[1], u: dentist, d: at(1, 9, 30), dur: 60, reason: 'Extraction', status: 'PLANNED' },
    { p: others[2], u: dentist, d: at(2, 16), dur: 30, reason: 'Consultation', status: 'PLANNED' },
    { p: karim, u: dentist, d: at(14, 9), dur: 60, reason: 'Préparation couronne 21', status: 'PLANNED' },
  ];
  for (const a of appointments) {
    await prisma.appointment.create({ data: { cabinetId: cabinet.id, patientId: a.p.id, practitionerId: a.u.id, date: a.d, durationMinutes: a.dur, reason: a.reason, status: a.status, arrivedAt: (a as any).arrivedAt } });
  }
  return cabinet;
}

async function main() {
  console.log('🌱 Seeding Cabinet Pro…');
  await seedCatalogue();

  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@cabinetpro.ma').toLowerCase();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin123!';
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: { email: superAdminEmail, password: await hash(superAdminPassword), firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN' },
  });
  await prisma.appSettings.upsert({ where: { id: 'global' }, update: {}, create: { id: 'global', businessName: 'Cabinet Pro' } });

  if (process.env.SEED_DEMO !== 'false') {
    const demo = await seedDemoCabinet();
    console.log(`✅ Cabinet de démonstration : ${demo.name}`);
    console.log('   demo.dentiste@cabinetpro.ma / Demo1234!   (titulaire, dentiste)');
    console.log('   demo.generaliste@cabinetpro.ma / Demo1234! (collaborateur, médecine générale)');
    console.log('   demo.assistant@cabinetpro.ma / Demo1234!   (assistante)');
  }
  console.log(`✅ Super Admin : ${superAdminEmail} / ${process.env.SUPER_ADMIN_PASSWORD ? '(mot de passe défini)' : superAdminPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
