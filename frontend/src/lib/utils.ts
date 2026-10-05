import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import i18n from '../i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'MAD',
): string {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)
  if (amount === null || amount === undefined || !Number.isFinite(numericAmount)) {
    return `0,00 ${currency}`
  }
  const fixed = numericAmount.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const text = `${withSpaces},${decPart} ${currency}`
  // In Arabic (right to left) the groups of digits would be reordered ("MAD 175,00 1"): keep the amount in one left-to-right run.
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? `\u2066${text}\u2069` : text
}

export function formatDateFR(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'dd/MM/yyyy', { locale: fr })
}

export function formatDateTimeFR(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  // "à" only in French; the other languages put the time right after the date.
  const lang = (i18n.resolvedLanguage || i18n.language || 'fr').slice(0, 2)
  return format(d, lang === 'fr' ? 'dd/MM/yyyy à HH:mm' : 'dd/MM/yyyy HH:mm', { locale: fr })
}

export function formatTimeFR(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'HH:mm', { locale: fr })
}

export function getInitials(name: string | null | undefined): string {
  if (!name || !name.trim()) return '??'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
