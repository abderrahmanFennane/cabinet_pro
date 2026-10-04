import { Indicator, Sex, zScore } from '../growth'

/**
 * Age corrected for prematurity (born before 37 weeks): chronological age minus the weeks missing to 40 weeks.
 * Used until 24 months of chronological age, as usual.
 */
export function correctedMonths(chronoMonths: number, gestationalWeeks?: number | null, gestationalDays?: number | null) {
  if (!gestationalWeeks || gestationalWeeks >= 37 || chronoMonths >= 24) return null
  const missingWeeks = 40 - (gestationalWeeks + (gestationalDays || 0) / 7)
  return Math.max(0, chronoMonths - missingWeeks / 4.348)
}

export type Measured = { date: string; age: number; value: number }

/**
 * Curve drop: the last measure has lost one standard deviation or more (about two major percentile lines)
 * compared with the best earlier measure taken at least two months before.
 */
export function growthDrop(indicator: Indicator, sex: Sex, points: Measured[]) {
  const withZ = points.map(p => ({ ...p, z: zScore(indicator, sex, p.age, p.value) })).filter(p => p.z !== null) as (Measured & { z: number })[]
  if (withZ.length < 2) return null
  const last = withZ[withZ.length - 1]
  const earlier = withZ.filter(p => last.age - p.age >= 2)
  if (!earlier.length) return null
  const best = earlier.reduce((a, b) => (b.z > a.z ? b : a))
  return last.z - best.z <= -1 ? { from: best, to: last, drop: Math.round((best.z - last.z) * 10) / 10 } : null
}

/**
 * Usual pediatric doses by weight (oral route). An aid to calculation only: the doctor checks the indication,
 * contraindications, age limits and the concentration of the product actually dispensed.
 */
export type Drug = {
  code: string; name: string; form: string; mgPerMl?: number
  mgPerKgDay: number; dosesPerDay: number; maxMgDay: number; minAgeMonths?: number
  duration: string; note: string; volumeOnly?: boolean
}

export const DRUGS: Drug[] = [
  { code: 'PARA', name: 'Paracétamol', form: 'suspension buvable 2,4 % (24 mg/mL)', mgPerMl: 24, mgPerKgDay: 60, dosesPerDay: 4, maxMgDay: 4000, duration: '3 jours, si fièvre ou douleur', note: '15 mg/kg toutes les 6 h, 60 mg/kg/j au maximum.' },
  { code: 'IBU', name: 'Ibuprofène', form: 'suspension buvable 20 mg/mL', mgPerMl: 20, mgPerKgDay: 30, dosesPerDay: 3, maxMgDay: 1200, minAgeMonths: 3, duration: '3 jours au maximum', note: '10 mg/kg toutes les 8 h, dès 3 mois. Éviter en cas de varicelle ou de déshydratation.' },
  { code: 'AMOX_ANG', name: 'Amoxicilline', form: 'suspension buvable 250 mg/5 mL (50 mg/mL)', mgPerMl: 50, mgPerKgDay: 50, dosesPerDay: 2, maxMgDay: 2000, duration: '6 jours', note: 'Angine streptococcique : 50 mg/kg/j en 2 prises, 6 jours.' },
  { code: 'AMOX_OMA', name: 'Amoxicilline', form: 'suspension buvable 500 mg/5 mL (100 mg/mL)', mgPerMl: 100, mgPerKgDay: 80, dosesPerDay: 2, maxMgDay: 3000, duration: '8 à 10 jours (5 jours après 2 ans)', note: 'Otite moyenne aiguë, pneumonie : 80 à 90 mg/kg/j en 2 ou 3 prises.' },
  { code: 'AMC', name: 'Amoxicilline-acide clavulanique', form: 'suspension buvable 100 mg/12,5 mg par mL', mgPerMl: 100, mgPerKgDay: 80, dosesPerDay: 3, maxMgDay: 3000, duration: '8 à 10 jours', note: '80 mg/kg/j d’amoxicilline en 3 prises.' },
  { code: 'AZI', name: 'Azithromycine', form: 'suspension buvable 200 mg/5 mL (40 mg/mL)', mgPerMl: 40, mgPerKgDay: 20, dosesPerDay: 1, maxMgDay: 500, duration: '3 jours', note: '20 mg/kg en 1 prise par jour, 3 jours (allergie aux bêtalactamines).' },
  { code: 'CFX', name: 'Céfixime', form: 'suspension buvable 100 mg/5 mL (20 mg/mL)', mgPerMl: 20, mgPerKgDay: 8, dosesPerDay: 2, maxMgDay: 400, minAgeMonths: 6, duration: '8 à 10 jours', note: '8 mg/kg/j en 2 prises, dès 6 mois.' },
  { code: 'PRED', name: 'Prednisolone', form: 'comprimé orodispersible (5 ou 20 mg)', mgPerKgDay: 1, dosesPerDay: 1, maxMgDay: 60, duration: '3 à 5 jours', note: '1 à 2 mg/kg/j en 1 prise le matin, 60 mg/j au maximum.' },
  { code: 'SRO', name: 'Soluté de réhydratation orale (SRO)', form: 'sachet à diluer', mgPerKgDay: 75, dosesPerDay: 1, maxMgDay: 4000, duration: 'sur 4 heures, puis à volonté', note: 'Déshydratation légère à modérée : 50 à 100 mL/kg sur 4 heures.', volumeOnly: true },
]

/** Drug families matched against the patient's allergies (lowercase, without accents). */
const FAMILY: Record<string, string[]> = {
  PARA: ['paracetamol'], IBU: ['ibuprofene', 'ains', 'anti-inflammatoire'],
  AMOX_ANG: ['amoxicilline', 'penicilline', 'betalactamine'], AMOX_OMA: ['amoxicilline', 'penicilline', 'betalactamine'],
  AMC: ['amoxicilline', 'clavulanique', 'augmentin', 'penicilline', 'betalactamine'], AZI: ['azithromycine', 'macrolide'],
  CFX: ['cefixime', 'cephalosporine', 'betalactamine'], PRED: ['prednisolone', 'corticoide', 'cortisone'], SRO: [],
}
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
/** True when the allergy text names the drug or its family (e.g. "pénicilline" for amoxicillin). */
export const allergic = (drug: Drug, allergies?: string | null) => !!allergies && FAMILY[drug.code].some(w => plain(allergies).includes(w))

/**
 * A milestone not ticked is only worth flagging for two years after its alert age:
 * for an older child it was most likely reached but never recorded.
 */
export const milestoneLate = (m: { alert: number }, ageMonths: number) => ageMonths >= m.alert && ageMonths < m.alert + 24

/** One dose for a weight: mg (capped by the daily maximum) and mL of the liquid form. */
export function doseFor(drug: Drug, weightKg: number) {
  if (drug.volumeOnly) return { mg: null, ml: Math.round(drug.mgPerKgDay * weightKg), perDay: null, capped: false }
  const day = Math.min(drug.mgPerKgDay * weightKg, drug.maxMgDay)
  const mg = Math.round(day / drug.dosesPerDay)
  const ml = drug.mgPerMl ? Math.round((mg / drug.mgPerMl) * 10) / 10 : null
  return { mg, ml, perDay: Math.round(day), capped: drug.mgPerKgDay * weightKg > drug.maxMgDay }
}

/**
 * Development milestones, typical age and the age after which their absence should alert (months).
 * Indicative landmarks (WHO motor windows, CDC 2022), not a diagnosis.
 */
export const MILESTONES: { code: string; area: 'MOTOR' | 'LANGUAGE' | 'SOCIAL' | 'FINE'; label: string; typical: number; alert: number }[] = [
  { code: 'SMILE', area: 'SOCIAL', label: 'Sourit en réponse', typical: 2, alert: 3 },
  { code: 'HEAD', area: 'MOTOR', label: 'Tient sa tête', typical: 3, alert: 4 },
  { code: 'GRASP', area: 'FINE', label: 'Attrape un objet', typical: 4, alert: 6 },
  { code: 'BABBLE', area: 'LANGUAGE', label: 'Babille', typical: 6, alert: 9 },
  { code: 'SIT', area: 'MOTOR', label: 'Tient assis sans appui', typical: 6, alert: 9 },
  { code: 'NAME', area: 'SOCIAL', label: 'Répond à son prénom', typical: 9, alert: 12 },
  { code: 'PINCER', area: 'FINE', label: 'Pince pouce-index', typical: 9, alert: 12 },
  { code: 'STAND', area: 'MOTOR', label: 'Se tient debout avec appui', typical: 9, alert: 12 },
  { code: 'POINT', area: 'SOCIAL', label: 'Pointe du doigt pour montrer', typical: 12, alert: 18 },
  { code: 'WORDS', area: 'LANGUAGE', label: 'Dit ses premiers mots', typical: 12, alert: 18 },
  { code: 'WALK', area: 'MOTOR', label: 'Marche seul', typical: 12, alert: 18 },
  { code: 'TWO_WORDS', area: 'LANGUAGE', label: 'Associe deux mots', typical: 24, alert: 30 },
  { code: 'PRETEND', area: 'SOCIAL', label: 'Joue à faire semblant', typical: 24, alert: 30 },
  { code: 'RUN', area: 'MOTOR', label: 'Court', typical: 24, alert: 30 },
  { code: 'SENTENCE', area: 'LANGUAGE', label: 'Fait des phrases de 3 mots', typical: 36, alert: 42 },
  { code: 'JUMP', area: 'MOTOR', label: 'Saute à pieds joints', typical: 30, alert: 42 },
  { code: 'DRAW', area: 'FINE', label: 'Copie un rond', typical: 36, alert: 48 },
]

/** Recommended screenings and the age (months) they are usually done. */
export const SCREENINGS: { test: 'HEARING' | 'VISION' | 'MCHAT' | 'HIP' | 'ANEMIA' | 'DENTAL' | 'LEAD' | 'OTHER'; label: string; when: string; from: number }[] = [
  { test: 'HEARING', label: 'Audition', when: 'à la naissance, puis si doute', from: 0 },
  { test: 'HIP', label: 'Hanches (luxation)', when: 'naissance à 3 mois', from: 0 },
  { test: 'VISION', label: 'Vision (strabisme, acuité)', when: '9-12 mois, puis 3-4 ans', from: 9 },
  { test: 'ANEMIA', label: 'Anémie (hémoglobine)', when: '9-12 mois', from: 9 },
  { test: 'MCHAT', label: 'Autisme (M-CHAT-R)', when: '18 et 24 mois', from: 16 },
  { test: 'DENTAL', label: 'Dents (caries)', when: 'dès 1 an, puis chaque année', from: 12 },
  { test: 'LEAD', label: 'Plomb (saturnisme)', when: 'si facteur de risque', from: 12 },
  { test: 'OTHER', label: 'Autre dépistage', when: '', from: 0 },
]
