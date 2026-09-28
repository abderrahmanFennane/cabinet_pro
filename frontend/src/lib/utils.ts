import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

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
  return `${withSpaces},${decPart} ${currency}`
}

export function formatDateFR(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'dd/MM/yyyy', { locale: fr })
}

export function formatDateTimeFR(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'dd/MM/yyyy à HH:mm', { locale: fr })
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
