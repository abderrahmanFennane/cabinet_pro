import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { apiError } from '../lib/hooks'
import { cn, formatCurrency } from '../lib/utils'
import { Link } from 'react-router-dom'
import { Act, ActScope, Cabinet, Specialty, User } from '../types'
import { SPECIALTY_MODULES } from '../specialties/registry'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { NativeSelect } from '../components/ui/native-select'
import { TOOTH_STATE_CODES } from '../components/dental/Odontogram'
import { useL } from '../lib/labels'

type SpecialtyRow = { code: string; name: string; isActive: boolean }
const emptyRow = { code: '', name: '', price: '0', category: 'Soins', scope: 'NONE' as ActScope, resultingState: '' }

/** F-SA-02: specialties offered at sign-up and the default act catalogue copied into new cabinets. */
export default function SpecialtiesAdmin() {
  const L = useL()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState('DENTISTRY')
  const [row, setRow] = useState(emptyRow)
  const { data: specialties = [] } = useQuery({ queryKey: ['specialties'], queryFn: async () => (await api.get('/specialties')).data.data as SpecialtyRow[] })
  const { data: cabinets = [] } = useQuery({ queryKey: ['all-cabinets'], queryFn: async () => (await api.get('/cabinets')).data.data as Cabinet[] })
  // Same query (and cache shape) as the Utilisateurs page.
  const { data: users = [] } = useQuery({ queryKey: ['users', ''], queryFn: async () => (await api.get('/users')).data as { data: User[] }, select: d => d.data })
  const dental = selected === 'DENTISTRY'
  const { data: acts = [] } = useQuery({ queryKey: ['default-acts', selected], queryFn: async () => (await api.get(`/specialties/${selected}/default-acts`)).data.data as Act[] })
  useEffect(() => setRow(emptyRow), [selected])

  const toggle = useMutation({
    mutationFn: (s: SpecialtyRow) => api.patch(`/specialties/${s.code}`, { isActive: !s.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['specialties'] }),
    onError: (err) => toast.error(apiError(err)),
  })
  const add = useMutation({
    mutationFn: () => api.post(`/specialties/${selected}/default-acts`, { ...row, price: Number(row.price), resultingState: row.resultingState || null, usesFaces: row.resultingState === 'FILLED' }),
    onSuccess: () => { toast.success(L('Acte ajouté')); setRow(emptyRow); queryClient.invalidateQueries({ queryKey: ['default-acts', selected] }) },
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
      <PageHeader title={t('nav.specialties')} subtitle={L('Chaque spécialité a sa propre interface. Choisissez celles proposées aux cabinets et leur catalogue d’actes par défaut.')} />
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {specialties.map(s => {
          const doctors = users.filter(u => u.specialty === s.code && (u.role === 'OWNER' || u.role === 'PRACTITIONER')).length
          return (
            <div key={s.code} className={cn('rounded-[14px] border bg-white p-3', selected === s.code ? 'border-primary ring-2 ring-primary/20' : 'border-[#D8E1DD]')}>
              <button type="button" className="block w-full text-start font-semibold" onClick={() => setSelected(s.code)}>{t(`specialty.${s.code}`, s.name)}</button>
              <p className="mt-0.5 text-[0.78rem] text-[#5A6B65]">{cabinets.filter(c => c.specialty === s.code && !c.isDemo).length} {L('cabinet(s)')} · {doctors} {L('médecin(s)')}</p>
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={s.isActive} onChange={() => toggle.mutate(s)} />{L('Proposée aux cabinets')}</label>
            </div>
          )
        })}
      </div>

      {SPECIALTY_MODULES[selected as Specialty] && (
        <section className="grid gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px] md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{L('Interface dédiée · onglet')} « {L(SPECIALTY_MODULES[selected as Specialty].tab)} » du dossier patient</p>
            <ul className="mt-2 grid gap-1 text-[0.92rem]">
              {SPECIALTY_MODULES[selected as Specialty].features.map(f => <li key={f} className="flex gap-2"><span className="font-extrabold text-[#1E7A45]">✓</span>{L(f)}</li>)}
            </ul>
          </div>
          <Button asChild variant="outline"><Link to={`/users`}>{L('Gérer les médecins')}</Link></Button>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-bold">{L('Catalogue par défaut')} · {t(`specialty.${selected}`)}</h3>
        <div className="overflow-x-auto rounded-[14px] border border-[#D8E1DD] bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3 text-start">{L('Code')}</th><th className="p-3 text-start">{L('Acte')}</th><th className="p-3 text-start">{L('Catégorie')}</th><th className="p-3 text-end">{L('Tarif indicatif')}</th><th /></tr></thead>
            <tbody>
              {acts.map(act => (
                <tr key={act.id} className="border-t border-border">
                  <td className="p-3 font-mono text-primary">{act.code}</td>
                  <td className="p-3">{act.name}{act.resultingState && <span className="ms-2 text-xs text-muted-foreground">→ {t(`toothState.${act.resultingState}`)}</span>}</td>
                  <td className="p-3">{act.category}</td>
                  <td className="p-3 text-end"><Input type="number" min={0} className="ms-auto h-8 w-28 text-end" defaultValue={Number(act.price)} aria-label={`${L('Tarif')} ${act.name}`} onBlur={e => Number(e.target.value) !== Number(act.price) && updatePrice.mutate({ id: act.id, price: Number(e.target.value) })} /><span className="sr-only">{formatCurrency(act.price)}</span></td>
                  <td className="p-3 text-end"><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={L('Supprimer')} onClick={() => remove.mutate(act.id)}><Trash2 size={14} /></Button></td>
                </tr>
              ))}
              {acts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{L('Aucun acte par défaut.')}</td></tr>}
            </tbody>
          </table>
        </div>
        <form className={cn('grid gap-2 rounded-[14px] border border-dashed border-[#D8E1DD] p-3', dental ? 'sm:grid-cols-[90px_1fr_120px_110px_130px_150px_auto]' : 'sm:grid-cols-[90px_1fr_160px_130px_auto]')} onSubmit={e => { e.preventDefault(); add.mutate() }}>
          <Input placeholder={L('Code')} value={row.code} onChange={e => setRow(r => ({ ...r, code: e.target.value }))} required aria-label={L('Code')} />
          <Input placeholder={L('Libellé')} value={row.name} onChange={e => setRow(r => ({ ...r, name: e.target.value }))} required aria-label={L('Libellé')} />
          <Input placeholder={L('Catégorie')} value={row.category} onChange={e => setRow(r => ({ ...r, category: e.target.value }))} aria-label={L('Catégorie')} />
          <Input type="number" min={0} value={row.price} onChange={e => setRow(r => ({ ...r, price: e.target.value }))} aria-label={L('Tarif')} />
          {dental && <NativeSelect value={row.scope} onChange={e => setRow(r => ({ ...r, scope: e.target.value as ActScope }))} aria-label={L('Porte sur')}><option value="NONE">—</option><option value="TOOTH">{L('Dent')}</option><option value="TEETH">{L('Dents')}</option><option value="QUADRANT">{L('Quadrant')}</option><option value="MOUTH">{L('Bouche')}</option></NativeSelect>}
          {dental && <NativeSelect value={row.resultingState} onChange={e => setRow(r => ({ ...r, resultingState: e.target.value }))} aria-label={L('État après l’acte')}><option value="">{L('État inchangé')}</option>{TOOTH_STATE_CODES.map(s => <option key={s} value={s}>{t(`toothState.${s}`)}</option>)}</NativeSelect>}
          <Button type="submit" disabled={add.isPending}><Plus size={16} /></Button>
        </form>
      </section>
    </div>
  )
}
