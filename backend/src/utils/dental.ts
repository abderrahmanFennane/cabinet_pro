// FDI two-digit notation: first digit = quadrant (1-4 permanent, 5-8 primary), second = position from the midline.

export type Dentition = 'PRIMARY' | 'MIXED' | 'PERMANENT';

export const TOOTH_STATES = [
  'HEALTHY', 'CARIES', 'FILLED', 'CROWN', 'BRIDGE', 'ENDO', 'IMPLANT', 'MISSING', 'FRACTURED', 'MOBILE', 'ERUPTING',
] as const;
export type ToothStateCode = typeof TOOTH_STATES[number];

// M mesial, D distal, O occlusal, I incisal, V vestibular, L lingual, P palatal.
export const FACES = ['M', 'D', 'O', 'I', 'V', 'L', 'P'] as const;

const range = (quadrant: number, count: number) => Array.from({ length: count }, (_, i) => quadrant * 10 + i + 1);

export const PERMANENT_TEETH = [1, 2, 3, 4].flatMap(q => range(q, 8));
export const PRIMARY_TEETH = [5, 6, 7, 8].flatMap(q => range(q, 5));

export function isValidTooth(n: number) {
  return PERMANENT_TEETH.includes(n) || PRIMARY_TEETH.includes(n);
}

/** Age in whole years at `now`. */
export function ageInYears(birthDate: Date, now = new Date()) {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

/** Spec 6.1: under 6 primary, 6 to 12 mixed, 12 and over permanent. No birth date: permanent. */
export function dentitionForAge(birthDate: Date | null | undefined, now = new Date()): Dentition {
  if (!birthDate) return 'PERMANENT';
  const age = ageInYears(birthDate, now);
  if (age < 6) return 'PRIMARY';
  if (age < 12) return 'MIXED';
  return 'PERMANENT';
}

export function teethFor(dentition: Dentition) {
  if (dentition === 'PRIMARY') return PRIMARY_TEETH;
  if (dentition === 'MIXED') return [...PERMANENT_TEETH, ...PRIMARY_TEETH];
  return PERMANENT_TEETH;
}

/** "36, 37" -> [36, 37]; throws on an unknown tooth number. */
export function parseTeeth(value: string | number[] | null | undefined): number[] {
  if (value === null || value === undefined || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(/[\s,;]+/).filter(Boolean).map(Number);
  const unique = [...new Set(list)];
  const invalid = unique.filter(n => !Number.isInteger(n) || !isValidTooth(n));
  if (invalid.length) throw new Error(`Numéro de dent invalide : ${invalid.join(', ')}`);
  return unique;
}

export function normalizeFaces(value: string | string[] | null | undefined): string | null {
  if (!value) return null;
  const list = (Array.isArray(value) ? value : value.split(/[\s,;]+/))
    .map(face => face.trim().toUpperCase())
    .filter(Boolean);
  const invalid = list.filter(face => !(FACES as readonly string[]).includes(face));
  if (invalid.length) throw new Error(`Face invalide : ${invalid.join(', ')}`);
  const unique = FACES.filter(face => list.includes(face));
  return unique.length ? unique.join(',') : null;
}

export function quadrantTeeth(quadrant: number) {
  if (quadrant >= 1 && quadrant <= 4) return range(quadrant, 8);
  if (quadrant >= 5 && quadrant <= 8) return range(quadrant, 5);
  return [];
}
