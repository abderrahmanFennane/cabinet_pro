import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { LABELS_AR, LABELS_EN } from './labels-data'

/**
 * Translation of the specialty screens. The French text is the key: `L('Croissance')` gives "Growth" in English
 * and "النمو" in Arabic, and the French text itself when a translation is missing (never a raw key on screen).
 * Clinical content typed by the doctor is never translated.
 */
export function useL() {
  const { i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'fr').slice(0, 2)
  return useCallback((fr: string) => (lang === 'ar' ? LABELS_AR[fr] : lang === 'en' ? LABELS_EN[fr] : undefined) ?? fr, [lang])
}
