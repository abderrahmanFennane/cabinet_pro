/**
 * Intraocular lens power, SRK/T formula (Retzlaff, Sanders, Kraff, J Cataract Refract Surg 1990; with the 1990 erratum).
 * An aid to check the biometer's printout: the surgeon decides with the biometer's own calculation.
 */
const N1 = 1.336 // aqueous and vitreous
const NC_1 = 0.333 // corneal index - 1
const V = 12 // spectacle vertex distance, mm

export type IolInput = { axialLength: number; k1: number; k2: number; aConstant: number; targetRefraction?: number }

function geometry({ axialLength: L, k1, k2, aConstant: A }: IolInput) {
  const K = (k1 + k2) / 2
  const r = 337.5 / K
  const lcor = L <= 24.2 ? L : -3.446 + 1.716 * L - 0.0237 * L * L
  const cw = -5.41 + 0.58412 * lcor + 0.098 * K
  const h = r * r - (cw * cw) / 4 >= 0 ? r - Math.sqrt(r * r - (cw * cw) / 4) : 0
  const offset = 0.62467 * A - 68.747 - 3.336
  const acd = h + offset
  const lopt = L + (0.65696 - 0.02029 * L)
  return { r, acd, lopt }
}

/** Power giving the target refraction (0 = emmetropia), in dioptres. */
export function srkt(input: IolInput) {
  const { r, acd, lopt } = geometry(input)
  const ref = input.targetRefraction ?? 0
  const num = 1000 * N1 * (N1 * r - NC_1 * lopt - 0.001 * ref * (V * (N1 * r - NC_1 * lopt) + lopt * r))
  const den = (lopt - acd) * (N1 * r - NC_1 * acd - 0.001 * ref * (V * (N1 * r - NC_1 * acd) + acd * r))
  return num / den
}

/** Refraction expected with a given implant power. */
export function predictedRefraction(input: IolInput, power: number) {
  const { r, acd, lopt } = geometry(input)
  const num = 1000 * N1 * (N1 * r - NC_1 * lopt) - power * (lopt - acd) * (N1 * r - NC_1 * acd)
  const den = N1 * (V * (N1 * r - NC_1 * lopt) + lopt * r) - 0.001 * power * (lopt - acd) * (V * (N1 * r - NC_1 * acd) + acd * r)
  return num / den
}

/** Implants sold in 0.5 D steps around the computed power, with the refraction each would give (biometer-style table). */
export function iolTable(input: IolInput, rows = 7) {
  const exact = srkt(input)
  const center = Math.round(exact * 2) / 2
  const half = Math.floor(rows / 2)
  return {
    exact,
    rows: Array.from({ length: rows }, (_, i) => {
      const power = center + (half - i) * 0.5
      return { power, refraction: predictedRefraction(input, power) }
    }),
  }
}
