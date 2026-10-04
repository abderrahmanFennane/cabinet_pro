/** Obstetric dating and fetal weight. Aids to the decision: the doctor checks and decides. */

const DAY = 86_400_000
const at0 = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`)

/** Weeks of amenorrhoea (SA) at a date, from the (corrected) last menstrual period. */
export function gestationalAge(lmp: string, at: Date = new Date()) {
  const days = Math.floor((at.getTime() - at0(lmp).getTime()) / DAY)
  return { weeks: Math.floor(days / 7), days: ((days % 7) + 7) % 7, total: days }
}
export const saLabel = (lmp: string, at?: Date) => { const g = gestationalAge(lmp, at); return `${g.weeks} SA${g.days ? ` + ${g.days} j` : ''}` }
/** Due date: LMP + 280 days (Naegele). */
export const dueDate = (lmp: string) => new Date(at0(lmp).getTime() + 280 * DAY)
export const addDays = (d: string, n: number) => new Date(at0(d).getTime() + n * DAY).toISOString().slice(0, 10)

/**
 * Gestational age from the crown-rump length (Robinson 1975, as used for first-trimester dating), in days.
 * Valid from 10 to 84 mm (about 7 to 14 SA); null outside.
 */
export function gaFromCrl(crlMm: number) {
  if (crlMm < 10 || crlMm > 84) return null
  return Math.round(8.052 * Math.sqrt(crlMm) + 23.73)
}

/** LMP implied by a CRL measured on a given date; the dating is corrected when it differs by more than 5 days. */
export function datingFromCrl(crlMm: number, examDate: string, lmp: string) {
  const ga = gaFromCrl(crlMm)
  if (ga === null) return null
  const lmpByCrl = addDays(examDate, -ga)
  const diff = Math.round((at0(lmp).getTime() - at0(lmpByCrl).getTime()) / DAY)
  return { gaDays: ga, lmp: lmpByCrl, diff, correct: Math.abs(diff) > 5 }
}

/** Estimated fetal weight, Hadlock 1985 (head circumference, abdominal circumference, femur length), grams. Inputs in mm. */
export function hadlockEfw(hcMm: number, acMm: number, flMm: number) {
  const hc = hcMm / 10, ac = acMm / 10, fl = flMm / 10
  return Math.round(10 ** (1.326 - 0.00326 * ac * fl + 0.0107 * hc + 0.0438 * ac + 0.158 * fl))
}

/** Median fetal weight by gestational age (Hadlock 1991): ln(w) = 0.578 + 0.332·GA − 0.00354·GA², SD 12.7 %. */
export const efwMedian = (weeks: number) => Math.exp(0.578 + 0.332 * weeks - 0.00354 * weeks * weeks)
const SD = 0.127

/** Percentile of an estimated weight at a gestational age (weeks with decimals), Hadlock 1991. */
export function efwPercentile(efw: number, weeks: number) {
  if (weeks < 20 || weeks > 42) return null
  const z = (efw / efwMedian(weeks) - 1) / SD
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const p = 0.3989423 * Math.exp(-z * z / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return Math.round((z > 0 ? 1 - p : p) * 100)
}
/** P10, P50, P90 weight curves (g), 20 to 41 SA. */
export const efwCurve = () => Array.from({ length: 22 }, (_, i) => {
  const w = 20 + i, m = efwMedian(w)
  return { weeks: w, p10: Math.round(m * (1 - 1.2816 * SD)), p50: Math.round(m), p90: Math.round(m * (1 + 1.2816 * SD)) }
})

/**
 * Usual prenatal calendar (windows in weeks of amenorrhoea; postnatal visit in days after delivery).
 * Indicative, based on the usual national recommendations; the doctor adapts it.
 */
export type Check = { code: string; label: string; from: number; to: number; rhNegOnly?: boolean; detail?: string }
export const PRENATAL: Check[] = [
  { code: 'FIRST_VISIT', label: 'Première consultation prénatale et déclaration', from: 6, to: 14 },
  { code: 'LAB_T1', label: 'Bilan du 1er trimestre', from: 6, to: 14, detail: 'Groupe, Rhésus, RAI, NFS, glycémie à jeun, toxoplasmose, rubéole, syphilis, VIH (proposé), ECBU' },
  { code: 'US_T1', label: 'Échographie du 1er trimestre (datation, clarté nucale)', from: 11, to: 14 },
  { code: 'T21', label: 'Dépistage de la trisomie 21 (marqueurs sériques)', from: 11, to: 14 },
  { code: 'US_T2', label: 'Échographie morphologique du 2e trimestre', from: 20, to: 25 },
  { code: 'OGTT', label: 'HGPO 75 g (diabète gestationnel)', from: 24, to: 29, detail: 'si facteur de risque' },
  { code: 'ANTI_D', label: 'RAI et prévention anti-D', from: 27, to: 29, rhNegOnly: true },
  { code: 'US_T3', label: 'Échographie du 3e trimestre', from: 30, to: 35 },
  { code: 'ANESTH', label: 'Consultation d’anesthésie', from: 32, to: 37 },
  { code: 'GBS', label: 'Prélèvement vaginal (streptocoque B)', from: 34, to: 38 },
  { code: 'TERM', label: 'Surveillance du terme', from: 41, to: 42, detail: 'si l’accouchement n’a pas eu lieu' },
]
/** Status of a check at the current gestational age (weeks). */
export const checkStatus = (c: Check, weeks: number, done: boolean) => (done ? 'done' : weeks >= c.to ? 'late' : weeks >= c.from ? 'due' : 'later') as 'done' | 'late' | 'due' | 'later'
