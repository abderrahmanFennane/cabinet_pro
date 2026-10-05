import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
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

type Table = Record<string, string>
type Pattern = { re: RegExp; names: string[]; to: string }
const compiled = new Map<Table, Pattern[]>()

/**
 * Entries with placeholders ("{n} rendez-vous supprimés") as patterns, the most specific first,
 * so messages built with values (counts, amounts, field names) are translated too.
 */
function patterns(table: Table) {
  let list = compiled.get(table)
  if (!list) {
    list = Object.keys(table).filter(k => /\{\w+\}/.test(k)).map(key => {
      const names: string[] = []
      const source = key.split(/(\{\w+\})/).map(part => {
        const name = /^\{(\w+)\}$/.exec(part)
        if (!name) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        names.push(name[1])
        return '(.+)'
      }).join('')
      return { re: new RegExp(`^${source}$`, 's'), names, to: table[key], literal: key.replace(/\{\w+\}/g, '').length }
    }).sort((a, b) => b.literal - a.literal)
    compiled.set(table, list)
  }
  return list
}

function translateWith(text: string, table: Table, depth: number): string {
  const exact = table[text] ?? table[text.trim()]
  if (exact !== undefined) return exact
  if (depth > 3) return text
  for (const p of patterns(table)) {
    const m = p.re.exec(text)
    if (!m) continue
    const values = Object.fromEntries(p.names.map((n, i) => [n, translateWith(m[i + 1], table, depth + 1)]))
    return p.to.replace(/\{(\w+)\}/g, (_, n) => values[n] ?? '')
  }
  return text
}

/** Outside React (API messages, formatters): French text in the current language, the French itself when unknown. */
export function translateText(fr: string, lang = (i18n.resolvedLanguage || i18n.language || 'fr').slice(0, 2)): string {
  if (!fr || lang === 'fr') return fr
  const table = lang === 'ar' ? LABELS_AR : lang === 'en' ? LABELS_EN : null
  return table ? translateWith(fr, table, 0) : fr
}
