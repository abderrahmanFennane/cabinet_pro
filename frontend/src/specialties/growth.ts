import who from './who-growth.json'

/**
 * WHO growth references: Child Growth Standards (birth to 5 years, 2006) and Growth Reference (5 to 19 years, 2007),
 * L/M/S values by month from the official WHO tables (who.int). z-scores with Cole's LMS method and, for weight and
 * BMI, the WHO restricted application beyond ±3 SD.
 */
export type Indicator = 'weight' | 'height' | 'head' | 'bmi'
export type Sex = 'M' | 'F'
type Row = [month: number, L: number, M: number, S: number]

const tables = (who as unknown as { indicators: Record<Indicator, Record<Sex, Row[]>> }).indicators

/** Ages covered by each indicator, in months. */
export const RANGE: Record<Indicator, [number, number]> = { weight: [0, 120], height: [0, 228], head: [0, 60], bmi: [0, 228] }
/** Percentiles drawn on WHO charts. */
export const PERCENTILES = [3, 15, 50, 85, 97] as const

export const ageInMonths = (birth: Date, at: Date) => (at.getTime() - birth.getTime()) / (30.4375 * 86_400_000)

function lms(indicator: Indicator, sex: Sex, months: number): [number, number, number] | null {
  const rows = tables[indicator]?.[sex]
  const [min, max] = RANGE[indicator]
  // A measure on the day of birth can land a few hours before it (time zones)
  if (months < 0 && months > -0.1) months = 0
  if (!rows || months < min || months > max) return null
  const i = Math.min(Math.floor(months), max - 1)
  const a = rows[i - rows[0][0]], b = rows[i + 1 - rows[0][0]]
  if (!a || !b) return null
  const f = months - i
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]
}

const valueAt = (L: number, M: number, S: number, z: number) => (L === 0 ? M * Math.exp(S * z) : M * (1 + L * S * z) ** (1 / L))

export function zScore(indicator: Indicator, sex: Sex, months: number, value: number): number | null {
  const p = lms(indicator, sex, months)
  if (!p || !(value > 0)) return null
  const [L, M, S] = p
  let z = L === 0 ? Math.log(value / M) / S : ((value / M) ** L - 1) / (L * S)
  // WHO: weight and BMI distributions are skewed, beyond ±3 SD the distance between SD2 and SD3 is used.
  if ((indicator === 'weight' || indicator === 'bmi') && Math.abs(z) > 3) {
    const sd3 = valueAt(L, M, S, Math.sign(z) * 3), sd2 = valueAt(L, M, S, Math.sign(z) * 2)
    z = Math.sign(z) * 3 + (value - sd3) / Math.abs(sd3 - sd2)
  }
  return z
}

/** Standard normal cumulative distribution (Abramowitz-Stegun 26.2.17), as a percentile 0-100. */
export function percentileOf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return (z > 0 ? 1 - p : p) * 100
}

const Z_OF: Record<number, number> = { 3: -1.8808, 15: -1.0364, 50: 0, 85: 1.0364, 97: 1.8808 }

/** Curves P3..P97 every month between `from` and `to` (months). */
export function percentileCurves(indicator: Indicator, sex: Sex, from: number, to: number) {
  const [min, max] = RANGE[indicator]
  const rows: Record<string, number>[] = []
  for (let m = Math.max(min, Math.floor(from)); m <= Math.min(max, Math.ceil(to)); m++) {
    const p = lms(indicator, sex, m)
    if (!p) continue
    const row: Record<string, number> = { age: m }
    for (const c of PERCENTILES) row[`p${c}`] = Math.round(valueAt(p[0], p[1], p[2], Z_OF[c]) * 100) / 100
    rows.push(row)
  }
  return rows
}

/** "P42", "< P1", "> P99" for a measure, or null outside the WHO tables. */
export function percentileLabel(indicator: Indicator, sex: Sex | null | undefined, months: number, value?: number | null) {
  if (!sex || value == null) return null
  const z = zScore(indicator, sex, months, value)
  if (z === null) return null
  const p = percentileOf(z)
  return { z, p, label: p < 1 ? '< P1' : p > 99 ? '> P99' : `P${Math.round(p)}`, alert: p < 3 || p > 97 }
}
