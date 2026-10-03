import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import { apiError, useCabinetApi } from '../lib/hooks'

export type ClinicalRecord<T = Record<string, any>> = {
  id: string
  kind: string
  specialty: string
  date: string
  data: T
  private: boolean
  practitionerId: string
  practitioner?: { id: string; firstName: string; lastName: string; title?: string | null } | null
  createdAt: string
}

/** Records of one specialty module for a patient, newest first, with save and delete. */
export function useRecords(patientId: string, specialty: string) {
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const base = `${cabinetApi}/patients/${patientId}/records`
  const key = ['records', patientId, specialty]

  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get(base, { params: { specialty } })).data.data as ClinicalRecord[],
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const save = useMutation({
    mutationFn: async ({ id, kind, date, data }: { id?: string; kind: string; date?: string; data: Record<string, any> }) => {
      if (id) await api.patch(`${base}/${id}`, { date, data })
      else await api.post(base, { kind, date, data })
    },
    onSuccess: () => { toast.success('Enregistré'); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${base}/${id}`),
    onSuccess: () => { toast.success('Supprimé'); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })

  const records = query.data || []
  const ofKind = <T = Record<string, any>>(kind: string) => records.filter(r => r.kind === kind) as ClinicalRecord<T>[]
  return { records, ofKind, isLoading: query.isLoading, save, remove }
}

/** "" -> null and numeric strings -> numbers, so forms can keep plain string state. */
export function cleanNumbers(values: Record<string, any>, numericKeys: string[]): Record<string, any> {
  const out: Record<string, any> = { ...values }
  for (const key of Object.keys(out)) {
    if (out[key] === '') out[key] = null
    else if (numericKeys.includes(key) && out[key] !== null) out[key] = Number(String(out[key]).replace(',', '.'))
  }
  return out
}

export const today = () => new Date().toISOString().slice(0, 10)
