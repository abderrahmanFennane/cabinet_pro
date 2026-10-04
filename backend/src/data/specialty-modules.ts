import { z } from 'zod';

/**
 * Structured records of each specialty module, stored in ClinicalRecord.data.
 * Every kind belongs to one specialty and has its own schema, so the data stays clean
 * even though it is stored as JSON.
 */

const num = (min: number, max: number) => z.coerce.number().min(min).max(max).nullable().optional();
const text = (max = 2000) => z.string().trim().max(max).nullable().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

// One eye: visual acuity (decimal, e.g. 0.8 or 10/10 written as 1.0), refraction and pressure.
const eye = z.object({
  va: text(20), // uncorrected, e.g. "4/10"
  vaCorrected: text(20),
  sphere: num(-30, 30),
  cylinder: num(-15, 15),
  axis: num(0, 180),
  add: num(0, 5),
  iop: num(0, 80), // mmHg
  cct: num(300, 800), // central corneal thickness (pachymetry), µm
}).partial();

const eyeSide = z.enum(['OD', 'OS']);
const prismBase = z.enum(['UP', 'DOWN', 'IN', 'OUT']).nullable().optional();
// One contact lens: power, astigmatism, addition, fitting (base curve, diameter) and product.
const lens = z.object({
  power: num(-30, 30), cylinder: num(-10, 10), axis: num(0, 180), add: num(0, 4),
  baseCurve: num(6, 11), diameter: num(8, 20), brand: text(80),
}).partial();

export const RECORD_KINDS = {
  // ─── Médecine générale ───
  VITALS: {
    specialty: 'GENERAL',
    schema: z.object({
      systolic: num(40, 300), diastolic: num(20, 200), pulse: num(20, 250), weight: num(0.5, 400), height: num(30, 250),
      temperature: num(30, 45), glucose: num(0.2, 6), hba1c: num(3, 20), spo2: num(50, 100), notes: text(),
    }),
  },

  // ─── Pédiatrie ───
  GROWTH: { specialty: 'PEDIATRICS', schema: z.object({ weight: num(0.3, 150), height: num(20, 220), headCircumference: num(20, 70), notes: text(500) }) },
  VACCINE: { specialty: 'PEDIATRICS', schema: z.object({ code: z.string().trim().min(1).max(40), lot: text(60), notes: text(500) }) },
  // Birth and neonatal history: term (for the corrected age of premature babies), measures at birth, feeding.
  BIRTH: {
    specialty: 'PEDIATRICS',
    schema: z.object({
      gestationalWeeks: num(22, 44), gestationalDays: num(0, 6), birthWeight: num(0.3, 7), birthLength: num(20, 65), birthHead: num(18, 45),
      apgar1: num(0, 10), apgar5: num(0, 10), delivery: z.enum(['VAGINAL', 'CESAREAN', 'INSTRUMENTAL']).nullable().optional(),
      feeding: z.enum(['BREAST', 'FORMULA', 'MIXED', 'DIVERSIFIED']).nullable().optional(), neonatal: text(1000), allergies: text(500),
    }),
  },
  // A development milestone reached (motor, language, social), with the age it was observed.
  MILESTONE: { specialty: 'PEDIATRICS', schema: z.object({ code: z.string().trim().min(1).max(40), ageMonths: num(0, 120), notes: text(300) }) },
  // Screening tests: hearing, vision, autism (M-CHAT), anaemia, hip, dental, etc.
  SCREENING: {
    specialty: 'PEDIATRICS',
    schema: z.object({
      test: z.enum(['HEARING', 'VISION', 'MCHAT', 'HIP', 'ANEMIA', 'DENTAL', 'LEAD', 'OTHER']), result: z.enum(['NORMAL', 'TO_CONTROL', 'ABNORMAL']),
      score: num(0, 100), notes: text(500),
    }),
  },

  // ─── Gynécologie-obstétrique ───
  PREGNANCY: {
    specialty: 'GYNECOLOGY',
    schema: z.object({
      lmp: day, // date des dernières règles
      status: z.enum(['ONGOING', 'DELIVERED', 'ENDED']).default('ONGOING'),
      gravidity: num(0, 20), parity: num(0, 20), outcome: text(500), notes: text(),
      // LMP corrected by the first-trimester dating ultrasound (crown-rump length); used instead of lmp when set.
      datingLmp: day.nullable().optional(),
      fetuses: num(1, 4), bloodGroup: z.enum(['A', 'B', 'AB', 'O']).nullable().optional(), rhesus: z.enum(['POS', 'NEG']).nullable().optional(),
      risk: text(500),
      // Outcome once delivered.
      deliveryDate: day.nullable().optional(), deliveryMode: z.enum(['VAGINAL', 'CESAREAN', 'INSTRUMENTAL']).nullable().optional(),
      babyWeight: num(0.3, 7), babySex: z.enum(['F', 'M']).nullable().optional(),
    }),
  },
  // A prenatal exam of the calendar done (ultrasound, tests, vaccination…), with its result.
  PRENATAL_CHECK: {
    specialty: 'GYNECOLOGY',
    schema: z.object({ pregnancyId: z.string().min(1), code: z.string().trim().min(1).max(40), result: text(500) }),
  },
  // Obstetric ultrasound: fetal biometry (mm), estimated weight (g, Hadlock), annexes, morphology.
  OB_ULTRASOUND: {
    specialty: 'GYNECOLOGY',
    schema: z.object({
      pregnancyId: z.string().min(1), fetus: num(1, 4),
      crl: num(1, 100), nuchal: num(0.1, 10), bpd: num(10, 120), hc: num(40, 400), ac: num(30, 450), fl: num(5, 90), efw: num(10, 6000),
      fetalHeartRate: num(50, 250), presentation: z.enum(['CEPHALIC', 'BREECH', 'TRANSVERSE']).nullable().optional(),
      placenta: text(120), amnioticFluid: z.enum(['NORMAL', 'OLIGO', 'HYDRAMNIOS']).nullable().optional(),
      morphology: text(1000), conclusion: text(), attachmentId: text(60),
    }),
  },
  // One previous pregnancy (obstetric history); gravidity and parity are counted from these.
  OB_PAST: {
    specialty: 'GYNECOLOGY',
    schema: z.object({
      year: num(1950, 2100), outcome: z.enum(['VAGINAL', 'CESAREAN', 'MISCARRIAGE', 'ECTOPIC', 'TERMINATION', 'STILLBIRTH']),
      weeks: num(4, 45), babyWeight: num(0.2, 7), complications: text(500),
    }),
  },
  PREGNANCY_VISIT: {
    specialty: 'GYNECOLOGY',
    schema: z.object({
      pregnancyId: z.string().min(1),
      type: z.enum(['VISIT', 'ULTRASOUND', 'LAB']).default('VISIT'),
      weight: num(30, 250), systolic: num(40, 300), diastolic: num(20, 200), fundalHeight: num(0, 60), fetalHeartRate: num(50, 250),
      notes: text(),
    }),
  },
  GYN_FOLLOWUP: {
    specialty: 'GYNECOLOGY',
    schema: z.object({
      contraception: text(120), lastSmear: day.nullable().optional(), cycle: text(120), notes: text(),
      lastHpv: day.nullable().optional(), hpvResult: z.enum(['NEGATIVE', 'POSITIVE']).nullable().optional(), lastMammogram: day.nullable().optional(),
    }),
  },

  // ─── Ophtalmologie ───
  EYE_EXAM: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({ od: eye, os: eye, anteriorSegment: text(), fundus: text(), diagnosis: text(), notes: text() }),
  },
  GLASSES: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({
      od: eye.pick({ sphere: true, cylinder: true, axis: true, add: true }).extend({ prism: num(0, 20), base: prismBase, pd: num(20, 45) }),
      os: eye.pick({ sphere: true, cylinder: true, axis: true, add: true }).extend({ prism: num(0, 20), base: prismBase, pd: num(20, 45) }),
      pd: num(40, 80), // pupillary distance, mm (both eyes)
      usage: z.enum(['DISTANCE', 'NEAR', 'PROGRESSIVE', 'BIFOCAL']).default('DISTANCE'),
      notes: text(500),
    }),
  },
  CONTACT_LENS: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({
      od: lens, os: lens,
      lensType: z.enum(['SOFT', 'TORIC', 'MULTIFOCAL', 'RGP', 'ORTHO_K', 'OTHER']).default('SOFT'),
      replacement: z.enum(['DAILY', 'TWO_WEEKS', 'MONTHLY', 'YEARLY', 'OTHER']).default('MONTHLY'),
      renewalDate: day.nullable().optional(),
      contraindications: text(500), notes: text(500),
    }),
  },
  VISUAL_FIELD: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({
      eye: eyeSide, device: text(60), program: text(30), // e.g. Humphrey 24-2 SITA Standard
      md: num(-40, 10), psd: num(0, 25), vfi: num(0, 100),
      reliable: z.boolean().default(true), pattern: text(300), progression: z.enum(['STABLE', 'SUSPECT', 'PROGRESSING']).nullable().optional(),
      attachmentId: text(60), notes: text(),
    }),
  },
  // OCT, retinal photographs, angiographies, topography: measures + attached images.
  IMAGING: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({
      eye: z.enum(['OD', 'OS', 'OU']), modality: z.enum(['OCT_RNFL', 'OCT_MACULA', 'OCT_GCC', 'FUNDUS_PHOTO', 'ANGIO_FLUO', 'ANGIO_ICG', 'TOPOGRAPHY', 'OTHER']),
      device: text(60), rnflAvg: num(20, 200), rnflSup: num(20, 250), rnflInf: num(20, 250), gcc: num(20, 150), cmt: num(100, 1000),
      interpretation: text(), attachmentIds: z.array(z.string().max(60)).max(12).default([]),
    }),
  },
  GLAUCOMA_PLAN: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({
      diagnosisOd: text(120), diagnosisOs: text(120), targetIopOd: num(5, 40), targetIopOs: num(5, 40),
      treatment: text(500), nextVisualField: day.nullable().optional(), notes: text(),
    }),
  },
  BIOMETRY: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({
      eye: eyeSide, device: text(60), k1: num(30, 60), k2: num(30, 60), axialLength: num(15, 40), acd: num(1, 6),
      aConstant: num(110, 125), targetRefraction: num(-10, 5), iolModel: text(80), chosenPower: num(-10, 45), notes: text(),
    }),
  },
  SURGERY: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({
      eye: eyeSide, procedure: z.string().trim().min(1).max(160), anesthesia: text(80), iolModel: text(80), iolPower: num(-10, 45),
      complications: text(500), report: text(5000), postOp: text(1000),
    }),
  },

  // ─── Cardiologie ───
  CARDIO_RISK: {
    specialty: 'CARDIOLOGY',
    schema: z.object({
      hypertension: z.boolean().default(false), diabetes: z.boolean().default(false), smoking: z.boolean().default(false),
      dyslipidemia: z.boolean().default(false), obesity: z.boolean().default(false), familyHistory: z.boolean().default(false),
      sedentary: z.boolean().default(false), notes: text(),
    }),
  },
  CARDIO_READING: {
    specialty: 'CARDIOLOGY',
    schema: z.object({ systolic: num(40, 300), diastolic: num(20, 200), heartRate: num(20, 250), inr: num(0.5, 10), notes: text(500) }),
  },
  ECG: {
    specialty: 'CARDIOLOGY',
    schema: z.object({
      rhythm: text(80), rate: num(20, 300), pr: num(40, 500), qrs: num(40, 300), qtc: num(200, 700), axis: num(-180, 180),
      interpretation: text(), attachmentId: text(60),
    }),
  },
  // Echocardiography (transthoracic): left ventricle, atria, right heart, valves.
  ECHO: {
    specialty: 'CARDIOLOGY',
    schema: z.object({
      lvef: num(5, 90), method: text(40), lvedd: num(20, 90), lvesd: num(10, 80), ivs: num(4, 30), pw: num(4, 30),
      lavi: num(5, 150), ee: num(1, 40), tapse: num(3, 40), paps: num(5, 120),
      valves: text(1000), pericardium: text(200), conclusion: text(), attachmentId: text(60),
    }),
  },
  HOLTER: {
    specialty: 'CARDIOLOGY',
    schema: z.object({
      hours: num(1, 336), rhythm: text(80), hrMin: num(20, 250), hrMean: num(20, 250), hrMax: num(20, 300),
      pvc: num(0, 200000), pac: num(0, 200000), longestPause: num(0, 30), afBurden: num(0, 100), nsvt: num(0, 1000),
      symptoms: text(500), conclusion: text(), attachmentId: text(60),
    }),
  },
  // Ambulatory blood pressure monitoring (24 h).
  ABPM: {
    specialty: 'CARDIOLOGY',
    schema: z.object({
      sys24: num(60, 250), dia24: num(30, 150), sysDay: num(60, 250), diaDay: num(30, 150), sysNight: num(50, 250), diaNight: num(30, 150),
      hr24: num(30, 200), validReadings: num(0, 100), conclusion: text(), attachmentId: text(60),
    }),
  },
  STRESS_TEST: {
    specialty: 'CARDIOLOGY',
    schema: z.object({
      protocol: text(40), durationMin: num(0, 40), mets: num(0, 30), hrMax: num(40, 250), sbpMax: num(60, 300),
      stopReason: text(200), symptoms: text(300), stChanges: text(300), arrhythmia: text(300),
      result: z.enum(['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE', 'NOT_DIAGNOSTIC']).nullable().optional(), conclusion: text(), attachmentId: text(60),
    }),
  },
  CARDIO_LAB: {
    specialty: 'CARDIOLOGY',
    schema: z.object({
      totalChol: num(0.5, 6), ldl: num(0.1, 5), hdl: num(0.1, 3), tg: num(0.1, 20), // g/L
      creatinine: num(1, 2000), creatinineUnit: z.enum(['MG_L', 'UMOL_L', 'MG_DL']).default('MG_L'), egfr: num(1, 200),
      potassium: num(1, 9), sodium: num(100, 180), ntprobnp: num(0, 70000), hba1c: num(3, 20), troponin: text(40), notes: text(),
    }),
  },
  // Atrial fibrillation scores: stroke risk (CHA2DS2-VASc) and bleeding risk (HAS-BLED); totals are recomputed on screen.
  CARDIO_SCORES: {
    specialty: 'CARDIOLOGY',
    schema: z.object({
      chf: z.boolean().default(false), hypertension: z.boolean().default(false), diabetes: z.boolean().default(false),
      strokeTia: z.boolean().default(false), vascular: z.boolean().default(false),
      uncontrolledHtn: z.boolean().default(false), renal: z.boolean().default(false), liver: z.boolean().default(false),
      bleeding: z.boolean().default(false), labileInr: z.boolean().default(false), drugs: z.boolean().default(false), alcohol: z.boolean().default(false),
      chadsvasc: num(0, 9), hasbled: num(0, 9), notes: text(500),
    }),
  },
  CARDIO_PLAN: {
    specialty: 'CARDIOLOGY',
    schema: z.object({
      diagnosis: text(300), anticoagulation: z.enum(['NONE', 'VKA', 'DOAC', 'ANTIPLATELET', 'DUAL_ANTIPLATELET']).default('NONE'),
      inrMin: num(1, 5), inrMax: num(1, 5), riskCategory: z.enum(['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']).nullable().optional(),
      bpTargetSys: num(90, 180), bpTargetDia: num(50, 110), treatment: text(1500), nextVisit: day.nullable().optional(), notes: text(),
    }),
  },

  // ─── Dermatologie ───
  LESION: {
    specialty: 'DERMATOLOGY',
    schema: z.object({
      zone: z.string().trim().min(1).max(40), // body map zone code, e.g. "FRONT_FACE"
      type: text(80), sizeMm: num(0, 500), description: text(), status: z.enum(['ACTIVE', 'IMPROVING', 'HEALED']).default('ACTIVE'),
    }),
  },

  // ─── Kinésithérapie ───
  PHYSIO_PROGRAM: {
    specialty: 'PHYSIOTHERAPY',
    schema: z.object({
      indication: z.string().trim().min(1).max(200), sessionsPrescribed: z.coerce.number().int().min(1).max(200), prescriber: text(120),
      goals: text(), status: z.enum(['ONGOING', 'DONE', 'STOPPED']).default('ONGOING'),
    }),
  },
  PHYSIO_SESSION: {
    specialty: 'PHYSIOTHERAPY',
    schema: z.object({ programId: z.string().min(1), pain: num(0, 10), exercises: text(), notes: text() }),
  },

  // ─── Psychiatrie / psychologie ───
  PSY_NOTE: { specialty: 'PSYCHIATRY', private: true, schema: z.object({ text: z.string().trim().min(1).max(20000) }) },
  PSY_SCALE: {
    specialty: 'PSYCHIATRY',
    schema: z.object({ scale: z.enum(['PHQ9', 'GAD7']), score: z.coerce.number().int().min(0).max(27), notes: text(500) }),
  },
} as const;

export type RecordKind = keyof typeof RECORD_KINDS;
export const RECORD_KIND_KEYS = Object.keys(RECORD_KINDS) as RecordKind[];

/** Kinds kept private to their author (only them, never the rest of the cabinet). */
export const isPrivateKind = (kind: RecordKind) => !!(RECORD_KINDS[kind] as { private?: boolean }).private;
