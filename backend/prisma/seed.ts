import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DENTAL_ACTS, GENERAL_ACTS } from '../src/data/catalogue';
import { resetDemoCabinet } from '../src/services/demo';

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
    const demo = await resetDemoCabinet();
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
