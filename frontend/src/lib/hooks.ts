import { useCallback, useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AuthContext } from '../providers/AuthProvider'
import api from './api'
import { TeamMember } from '../types'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/** Cabinet being worked on: the user's own, or for the Super Admin the one in ?cabinetId= (demo or support access). */
export function useCabinetId(): string {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  if (user?.role === 'SUPER_ADMIN') return searchParams.get('cabinetId') || ''
  return user?.cabinetId || ''
}

/** Builds in-cabinet links that keep the Super Admin's ?cabinetId= context. */
export function useCabinetPath() {
  const { user } = useAuth()
  const cabinetId = useCabinetId()
  return useCallback((path: string) => {
    if (user?.role !== 'SUPER_ADMIN' || !cabinetId) return path
    return `${path}${path.includes('?') ? '&' : '?'}cabinetId=${cabinetId}`
  }, [user?.role, cabinetId])
}

/** Base URL of the cabinet data API. */
export function useCabinetApi() {
  const cabinetId = useCabinetId()
  return `/cabinets/${cabinetId}`
}

export function useTeam() {
  const cabinetId = useCabinetId()
  return useQuery({
    queryKey: ['team', cabinetId],
    queryFn: async () => (await api.get(`/cabinets/${cabinetId}/team`)).data.data as TeamMember[],
    enabled: !!cabinetId,
    // Reference data used by every practitioner select: rarely changes, invalidated when the team is edited.
    staleTime: 5 * 60_000,
  })
}

/** Value that only updates once the user stops typing, so a search does not fire a request per keystroke. */
export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export const practitionerName = (p?: { title?: string | null; firstName: string; lastName: string } | null) =>
  p ? `${p.title ? `${p.title} ` : ''}${p.firstName} ${p.lastName}` : ''

export const apiError = (err: any, fallback = 'Une erreur est survenue') =>
  err?.response?.data?.error || err?.response?.data?.message || fallback

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}
