import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { apiError } from '../lib/hooks'
import { cn, formatCurrency } from '../lib/utils'
import { Act, ActScope } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { NativeSelect } from '../components/ui/native-select'
import { TOOTH_STATE_CODES } from '../components/dental/Odontogram'

type SpecialtyRow = { code: string; name: string; isActive: boolean }
const emptyRow = { code: '', name: '', price: '0', category: 'Soins', scope: 'NONE' as ActScope, resultingState: '' }

/** F-SA-02: specialties offered at sign-up and the default act catalogue copied into new cabinets. */
export default function SpecialtiesAdmin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState('DENTISTRY')
  const [row, setRow] = useState(emptyRow)
  const { data: specialties = [] } = useQuery({ queryKey: ['specialties'], queryFn: async () => (await api.get('/specialties')).data.data as SpecialtyRow[] })
  const { data: acts = [] } = useQuery({ queryKey: ['default-acts', selected], queryFn: async () => (await api.get(`/specialties/${selected}/default-acts`)).data.data as Act[] })
  useEffect(() => setRow(emptyRow), [selected])

  const toggle = useMutation({
    mutationFn: (s: SpecialtyRow) => api.patch(`/specialties/${s.code}`, { isActive: !s.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['specialties'] }),
    onError: (err) => toast.error(apiError(err)),
  })
  const add = useMutation({
    mutationFn: () => api.post(`/specialties/${selected}/default-acts`, { ...row, price: Number(row.price), resultingState: row.resultingState || null, usesFaces: row.resultingState === 'FILLED' }),
    onSuccess: () => { toast.success('Acte ajouté'); setRow(emptyRow); queryClient.invalidateQueries({ queryKey: ['default-acts', selected] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const updatePrice = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) => api.patch(`/specialties/${selected}/default-acts/${id}`, { price }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['default-acts', selected] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/specialties/${selected}/default-acts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['default-acts', selected] }),
  })

  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.specialties')} subtitle="Spécialités proposées à l’inscription et catalogues d’actes par défaut." />
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {specialties.map(s => (
          <div key={s.code} className={cn('rounded-2xl border bg-white p-3', selected === s.code ? 'border-primary ring-2 ring-primary/20' : 'border-border')}>
            <button type="button" className="block w-full text-start font-semibold" onClick={() => setSelected(s.code)}>{t(`specialty.${s.code}`, s.name)}</button>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={s.isActive} onChange={() => toggle.mutate(s)} />Proposée</label>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h3 className="font-bold">Catalogue par défaut · {t(`specialty.${selected}`)}</h3>
        <div className="overflow-x-auto rounded-[14px] border border-[#D8E1DD] bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3 text-start">Code</th><th className="p-3 text-start">Acte</th><th className="p-3 text-start">Catégorie</th><th className="p-3 text-end">Tarif indicatif</th><th /></tr></thead>
            <tbody>
              {acts.map(act => (
                <tr key={act.id} className="border-t border-border">
                  <td className="p-3 font-mono text-primary">{act.code}</td>
                  <td className="p-3">{act.name}{act.resultingState && <span className="ms-2 text-xs text-muted-foreground">→ {t(`toothState.${act.resultingState}`)}</span>}</td>
                  <td className="p-3">{act.category}</td>
                  <td className="p-3 text-end"><Input type="number" min={0} className="ms-auto h-8 w-28 text-end" defaultValue={Number(act.price)} aria-label={`Tarif ${act.name}`} onBlur={e => Number(e.target.value) !== Number(act.price) && updatePrice.mutate({ id: act.id, price: Number(e.target.value) })} /><span className="sr-only">{formatCurrency(act.price)}</span></td>
                  <td className="p-3 text-end"><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Supprimer" onClick={() => remove.mutate(act.id)}><Trash2 size={14} /></Button></td>
                </tr>
              ))}
              {acts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucun acte par défaut.</td></tr>}
            </tbody>
          </table>
        </div>
        <form className="grid gap-2 rounded-2xl border border-dashed border-border p-3 sm:grid-cols-[90px_1fr_120px_110px_130px_150px_auto]" onSubmit={e => { e.preventDefault(); add.mutate() }}>
          <Input placeholder="Code" value={row.code} onChange={e => setRow(r => ({ ...r, code: e.target.value }))} required aria-label="Code" />
          <Input placeholder="Libellé" value={row.name} onChange={e => setRow(r => ({ ...r, name: e.target.value }))} required aria-label="Libellé" />
          <Input placeholder="Catégorie" value={row.category} onChange={e => setRow(r => ({ ...r, category: e.target.value }))} aria-label="Catégorie" />
          <Input type="number" min={0} value={row.price} onChange={e => setRow(r => ({ ...r, price: e.target.value }))} aria-label="Tarif" />
          <NativeSelect value={row.scope} onChange={e => setRow(r => ({ ...r, scope: e.target.value as ActScope }))} aria-label="Porte sur"><option value="NONE">—</option><option value="TOOTH">Dent</option><option value="TEETH">Dents</option><option value="QUADRANT">Quadrant</option><option value="MOUTH">Bouche</option></NativeSelect>
          <NativeSelect value={row.resultingState} onChange={e => setRow(r => ({ ...r, resultingState: e.target.value }))} aria-label="État après l’acte"><option value="">État inchangé</option>{TOOTH_STATE_CODES.map(s => <option key={s} value={s}>{t(`toothState.${s}`)}</option>)}</NativeSelect>
          <Button type="submit" disabled={add.isPending}><Plus size={16} /></Button>
        </form>
      </section>
    </div>
  )
}
