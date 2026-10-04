/** Cardiology scores and formulas. Aids to the decision, shown with their source; the doctor decides. */

export type ScoreInput = {
  age: number | null; female: boolean
  chf: boolean; hypertension: boolean; diabetes: boolean; strokeTia: boolean; vascular: boolean
  uncontrolledHtn: boolean; renal: boolean; liver: boolean; bleeding: boolean; labileInr: boolean; drugs: boolean; alcohol: boolean
}

/** CHA2DS2-VASc (stroke risk in atrial fibrillation), 0-9. */
export function chadsvasc(s: ScoreInput) {
  const age = s.age ?? 0
  return (s.chf ? 1 : 0) + (s.hypertension ? 1 : 0) + (age >= 75 ? 2 : age >= 65 ? 1 : 0) + (s.diabetes ? 1 : 0)
    + (s.strokeTia ? 2 : 0) + (s.vascular ? 1 : 0) + (s.female ? 1 : 0)
}

/** Reading of CHA2DS2-VASc (ESC 2020): anticoagulation recommended from 2 (men) / 3 (women), to consider at 1 / 2. */
export function chadsvascAdvice(score: number, female: boolean): 'NONE' | 'CONSIDER' | 'RECOMMENDED' {
  const s = female ? score - 1 : score
  return s >= 2 ? 'RECOMMENDED' : s === 1 ? 'CONSIDER' : 'NONE'
}

/** HAS-BLED (bleeding risk under anticoagulation), 0-9; 3 or more = high risk: correct what can be corrected and follow closely. */
export function hasbled(s: ScoreInput) {
  return (s.uncontrolledHtn ? 1 : 0) + (s.renal ? 1 : 0) + (s.liver ? 1 : 0) + (s.strokeTia ? 1 : 0) + (s.bleeding ? 1 : 0)
    + (s.labileInr ? 1 : 0) + ((s.age ?? 0) > 65 ? 1 : 0) + (s.drugs ? 1 : 0) + (s.alcohol ? 1 : 0)
}

export type CreatinineUnit = 'MG_L' | 'UMOL_L' | 'MG_DL'
/** Creatinine in mg/dL (Moroccan labs often give mg/L or µmol/L). */
export const toMgDl = (value: number, unit: CreatinineUnit) => (unit === 'MG_L' ? value / 10 : unit === 'UMOL_L' ? value / 88.4 : value)

/** eGFR, CKD-EPI 2021 equation (without race), mL/min/1.73 m². */
export function egfr(creatinine: number, unit: CreatinineUnit, age: number, female: boolean) {
  const scr = toMgDl(creatinine, unit)
  const k = female ? 0.7 : 0.9
  const a = female ? -0.241 : -0.302
  const v = 142 * Math.min(scr / k, 1) ** a * Math.max(scr / k, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1)
  return Math.round(v)
}
export const ckdStage = (gfr: number) => (gfr >= 90 ? 'G1' : gfr >= 60 ? 'G2' : gfr >= 45 ? 'G3a' : gfr >= 30 ? 'G3b' : gfr >= 15 ? 'G4' : 'G5')

/** LDL-cholesterol target in g/L by cardiovascular risk (ESC/EAS 2019). */
export const LDL_TARGET: Record<'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH', number> = { LOW: 1.16, MODERATE: 1.0, HIGH: 0.7, VERY_HIGH: 0.55 }

/** Maximal heart rate predicted for age (220 - age) and the share reached at the stress test. */
export const predictedMaxHr = (age: number) => 220 - age

/** Night-time dip of systolic pressure (ABPM): dipper 10-20 %, non-dipper < 10 %, reverse dipper < 0. */
export function dipping(sysDay: number, sysNight: number) {
  const pct = Math.round(((sysDay - sysNight) / sysDay) * 1000) / 10
  return { pct, kind: pct < 0 ? 'REVERSE' : pct < 10 ? 'NON_DIPPER' : pct <= 20 ? 'DIPPER' : 'EXTREME' } as const
}

/** ABPM thresholds for hypertension (ESC 2018): 24 h ≥ 130/80, day ≥ 135/85, night ≥ 120/70. */
export function abpmHypertension(v: { sys24?: number | null; dia24?: number | null; sysDay?: number | null; diaDay?: number | null; sysNight?: number | null; diaNight?: number | null }) {
  const over = (s?: number | null, d?: number | null, ts = 0, td = 0) => (s != null && s >= ts) || (d != null && d >= td)
  return { h24: over(v.sys24, v.dia24, 130, 80), day: over(v.sysDay, v.diaDay, 135, 85), night: over(v.sysNight, v.diaNight, 120, 70) }
}
