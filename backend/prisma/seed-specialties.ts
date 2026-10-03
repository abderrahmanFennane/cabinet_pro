import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { copyDefaultActs, ensureCatalogue, planQuotas } from '../src/services/cabinet-setup';

/**
 * One cabinet per specialty, each with its owner (médecin titulaire) account, to try every specialty's interface.
 * Safe to run again: an existing account or cabinet is left as it is (only the password is reset).
 *
 *   npm run db:seed:specialties            (password: Cabinet2026!)
 *   SPECIALTY_PASSWORD=... npm run db:seed:specialties
 */
const prisma = new PrismaClient();
const PASSWORD = process.env.SPECIALTY_PASSWORD || 'Cabinet2026!';
const PLAN = process.env.SPECIALTY_PLAN || 'PRO';

const CABINETS = [
  { specialty: 'DENTISTRY', name: 'Cabinet dentaire Anfa', city: 'Casablanca', slug: 'dentiste', title: 'Dr', firstName: 'Yasmine', lastName: 'Alami' },
  { specialty: 'GENERAL', name: 'Cabinet de médecine générale Agdal', city: 'Rabat', slug: 'generaliste', title: 'Dr', firstName: 'Omar', lastName: 'Benjelloun' },
  { specialty: 'PEDIATRICS', name: 'Cabinet de pédiatrie Maârif', city: 'Casablanca', slug: 'pediatre', title: 'Dr', firstName: 'Sanaa', lastName: 'Chraibi' },
  { specialty: 'GYNECOLOGY', name: 'Cabinet de gynécologie Hivernage', city: 'Marrakech', slug: 'gyneco', title: 'Dr', firstName: 'Kenza', lastName: 'Tazi' },
  { specialty: 'OPHTHALMOLOGY', name: 'Centre ophtalmologique Fès', city: 'Fès', slug: 'ophtalmo', title: 'Dr', firstName: 'Rachid', lastName: 'Fassi' },
  { specialty: 'CARDIOLOGY', name: 'Cabinet de cardiologie Tanger', city: 'Tanger', slug: 'cardio', title: 'Dr', firstName: 'Hassan', lastName: 'Idrissi' },
  { specialty: 'DERMATOLOGY', name: 'Cabinet de dermatologie Souissi', city: 'Rabat', slug: 'dermato', title: 'Dr', firstName: 'Salma', lastName: 'Lahlou' },
  { specialty: 'PHYSIOTHERAPY', name: 'Centre de kinésithérapie Agadir', city: 'Agadir', slug: 'kine', title: null, firstName: 'Youssef', lastName: 'Amrani' },
  { specialty: 'PSYCHIATRY', name: 'Cabinet de psychiatrie Gauthier', city: 'Casablanca', slug: 'psy', title: 'Dr', firstName: 'Nadia', lastName: 'Sqalli' },
] as const;

async function main() {
  await ensureCatalogue(prisma);
  const plan = await prisma.plan.findUnique({ where: { code: PLAN } });
  if (!plan) throw new Error(`Plan ${PLAN} introuvable`);
  const password = await bcrypt.hash(PASSWORD, 12);
  const rows: string[][] = [];

  for (const c of CABINETS) {
    const email = `admin.${c.slug}@cabinetpro.ma`;
    const existing = await prisma.user.findUnique({ where: { email }, include: { cabinet: true } });
    let cabinetName = existing?.cabinet?.name;
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { password, isActive: true } });
    } else {
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      const cabinet = await prisma.$transaction(async (tx) => {
        const created = await tx.cabinet.create({
          data: {
            name: c.name, specialty: c.specialty, city: c.city, phone: '0522000000', email,
            plan: plan.code, subscriptionStatus: 'ACTIVE', currentPeriodEnd: periodEnd, ...planQuotas(plan),
          },
        });
        await tx.subscriptionHistory.create({ data: { cabinetId: created.id, plan: plan.code, status: 'ACTIVE', startedAt: new Date(), periodEnd } });
        await copyDefaultActs(tx, created.id, c.specialty);
        await tx.user.create({
          data: { email, password, title: c.title, firstName: c.firstName, lastName: c.lastName, phone: '0600000000', role: 'OWNER', specialty: c.specialty, seesAllPatients: true, cabinetId: created.id },
        });
        return created;
      });
      cabinetName = cabinet.name;
    }
    rows.push([c.specialty, cabinetName || c.name, email, existing ? 'existait (mot de passe remis)' : 'créé']);
  }

  console.log(`\nCabinets par spécialité (plan ${plan.name}), mot de passe : ${PASSWORD}\n`);
  for (const [specialty, name, email, state] of rows) console.log(`${specialty.padEnd(14)} ${name.padEnd(38)} ${email.padEnd(34)} ${state}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
