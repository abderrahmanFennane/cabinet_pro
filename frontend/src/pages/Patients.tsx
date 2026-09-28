import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Plus, Search, Users } from 'lucide-react'
import api from '../lib/api'
import { useCabinetApi, useCabinetPath } from '../lib/hooks'
import { Patient } from '../types'
import { PageHeader, EmptyState } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import PatientFormDialog from '../components/patient/PatientFormDialog'

export default function Patients() {
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 250)
    return () => clearTimeout(id)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['patients', cabinetApi, query, page],
    queryFn: async () => (await api.get(`${cabinetApi}/patients`, { params: { search: query || undefined, page, limit: 25 } })).data as { data: Patient[]; meta: { total: number; totalPages: number } },
    // Keep the current list on screen while the next search or page loads.
    placeholderData: keepPreviousData,
  })
  const patients = data?.data || []

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('nav.patients')}
        subtitle={data ? `${data.meta.total} patient(s)` : undefined}
        actions={<Button onClick={() => setCreating(true)}><Plus size={17} className="me-1.5" />Nouveau patient</Button>}
      />
      <div className="relative max-w-md">
        <Search size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="ps-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, téléphone ou CIN" aria-label="Rechercher un patient" autoFocus />
      </div>

      {!isLoading && patients.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={query ? 'Aucun patient trouvé' : 'Aucun patient'} description={query ? 'Vérifiez l’orthographe ou cherchez par téléphone.' : 'Créez votre premier patient.'}
          action={<Button onClick={() => setCreating(true)}><Plus size={16} className="me-1" />Nouveau patient</Button>} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-[#D8E1DD] bg-white">
          {patients.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => navigate(cabinetPath(`/patients/${p.id}`))} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-muted/60">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">{p.lastName[0]}{p.firstName[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.lastName.toUpperCase()} {p.firstName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[p.age !== null && `${p.age} ans`, p.phone, p.cin && `CIN ${p.cin}`, p.coverage !== 'NONE' && t(`coverage.${p.coverage}`)].filter(Boolean).join(' · ')}</span>
                </span>
                <ChevronRight size={18} className="text-muted-foreground rtl:rotate-180" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
          <span className="text-sm text-muted-foreground">{page} / {data.meta.totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Suivant</Button>
        </div>
      )}

      <PatientFormDialog open={creating} onOpenChange={setCreating} onSaved={(p) => navigate(cabinetPath(`/patients/${p.id}`))} />
    </div>
  )
}
