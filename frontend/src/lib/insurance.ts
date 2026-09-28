import { TFunction } from 'i18next'
import { Coverage } from '../types'

type Insured = {
  coverage: Coverage
  coverageNumber?: string | null
  complementaryInsurance?: string | null
  complementaryNumber?: string | null
}

/**
 * For a private insurance or a mutuelle alone, `complementaryInsurance` holds the company's name
 * (there is no separate top-up cover); for CNSS, CNOPS, AMO Tadamon and FAR it is the top-up cover.
 */
export const namesInsurer = (coverage: Coverage) => coverage === 'PRIVATE' || coverage === 'MUTUELLE'

/** "CNSS (AMO) · N° 123" / "Assurance privée · Wafa Assurance · N° WA-1", and the top-up cover if any. */
export function insuranceText(p: Insured, t: TFunction) {
  const base = [t(`coverage.${p.coverage}`), namesInsurer(p.coverage) ? p.complementaryInsurance : null, p.coverageNumber ? `N° ${p.coverageNumber}` : null]
    .filter(Boolean).join(' · ')
  const complementary = !namesInsurer(p.coverage) && p.complementaryInsurance
    ? [p.complementaryInsurance, p.complementaryNumber ? `N° ${p.complementaryNumber}` : null].filter(Boolean).join(' · ')
    : null
  return { base, complementary }
}

/** Short label for lists and headers: "CNOPS (AMO) + MGPAP", "Assurance privée Wafa Assurance". */
export function insuranceShort(p: Insured, t: TFunction) {
  if (p.coverage === 'NONE' && !p.complementaryInsurance) return null
  if (namesInsurer(p.coverage)) return [t(`coverage.${p.coverage}`), p.complementaryInsurance].filter(Boolean).join(' ')
  return [p.coverage !== 'NONE' ? t(`coverage.${p.coverage}`) : null, p.complementaryInsurance].filter(Boolean).join(' + ')
}
