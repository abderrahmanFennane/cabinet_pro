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

  // ─── Gynécologie-obstétrique ───
  PREGNANCY: {
    specialty: 'GYNECOLOGY',
    schema: z.object({
      lmp: day, // date des dernières règles
      status: z.enum(['ONGOING', 'DELIVERED', 'ENDED']).default('ONGOING'),
      gravidity: num(0, 20), parity: num(0, 20), outcome: text(500), notes: text(),
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
    schema: z.object({ contraception: text(120), lastSmear: day.nullable().optional(), cycle: text(120), notes: text() }),
  },

  // ─── Ophtalmologie ───
  EYE_EXAM: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({ od: eye, os: eye, anteriorSegment: text(), fundus: text(), diagnosis: text(), notes: text() }),
  },
  GLASSES: {
    specialty: 'OPHTHALMOLOGY',
    schema: z.object({
      od: eye.pick({ sphere: true, cylinder: true, axis: true, add: true }),
      os: eye.pick({ sphere: true, cylinder: true, axis: true, add: true }),
      pd: num(40, 80), // pupillary distance, mm
      usage: z.enum(['DISTANCE', 'NEAR', 'PROGRESSIVE', 'BIFOCAL']).default('DISTANCE'),
      notes: text(500),
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
    schema: z.object({ rhythm: text(80), rate: num(20, 300), interpretation: text(), attachmentId: text(60) }),
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
