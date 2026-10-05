import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, ShieldCheck } from 'lucide-react'
import api from '../lib/api'
import { apiError, useAuth, useCabinetApi, useCabinetId, useTeam } from '../lib/hooks'
import { cn, formatCurrency, formatDateTimeFR } from '../lib/utils'
import { Act, ActScope, Cabinet, ToothStateCode } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { NativeSelect } from '../components/ui/native-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { RemindersCard } from '../components/settings/RemindersCard'
import { OnlineBookingCard } from '../components/settings/OnlineBookingCard'
import { TOOTH_STATE_CODES } from '../components/dental/Odontogram'
import { useL } from '../lib/labels'

type Tab = 'cabinet' | 'acts' | 'booking' | 'reminders' | 'privacy'

const LEADS = [{ value: 1440, label: 'La veille (24 h avant)' }, { value: 120, label: '2 h avant' }, { value: 60, label: '1 h avant' }]

function CabinetInfo({ cabinet }: { cabinet: Cabinet }) {
  const L = useL()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '', email: '', letterhead: '' })
  useEffect(() => setForm({ name: cabinet.name, address: cabinet.address || '', city: cabinet.city || '', phone: cabinet.phone || '', email: cabinet.email || '', letterhead: cabinet.letterhead || '' }), [cabinet])
  const save = useMutation({
    mutationFn: () => api.patch(`/cabinets/${cabinet.id}`, { ...form, address: form.address || null, city: form.city || null, phone: form.phone || null, email: form.email || null, letterhead: form.letterhead || null }),
    onSuccess: () => { toast.success(L('Cabinet mis à jour')); queryClient.invalidateQueries({ queryKey: ['cabinet', cabinet.id] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value }))
  return (
    <form className="grid gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); save.mutate() }}>
      <div className="space-y-1.5"><Label htmlFor="s-name">{L('Nom du cabinet')}</Label><Input id="s-name" value={form.name} onChange={set('name')} required /></div>
      <div className="space-y-1.5"><Label htmlFor="s-phone">{L('Téléphone (affiché dans les rappels)')}</Label><Input id="s-phone" value={form.phone} onChange={set('phone')} /></div>
      <div className="space-y-1.5"><Label htmlFor="s-address">{L('Adresse')}</Label><Input id="s-address" value={form.address} onChange={set('address')} /></div>
      <div className="space-y-1.5"><Label htmlFor="s-city">{L('Ville')}</Label><Input id="s-city" value={form.city} onChange={set('city')} /></div>
      <div className="space-y-1.5"><Label htmlFor="s-email">{L('Email')}</Label><Input id="s-email" type="email" value={form.email} onChange={set('email')} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-letterhead">{L('En-tête des ordonnances et factures')}</Label><Textarea id="s-letterhead" rows={4} value={form.letterhead} onChange={set('letterhead')} placeholder={'Dr … — Chirurgien-dentiste\nDiplômé(e) de …\nINPE : …'} /></div>
      <Button type="submit" className="sm:col-span-2 sm:w-fit" disabled={save.isPending}>{L('Enregistrer')}</Button>
    </form>
  )
}

function ReminderLeads({ cabinet }: { cabinet: Cabinet }) {
  const L = useL()
  const queryClient = useQueryClient()
  const [leads, setLeads] = useState<number[]>(cabinet.reminderLeadMinutes || [1440, 60])
  const save = useMutation({
    mutationFn: (next: number[]) => api.patch(`/cabinets/${cabinet.id}`, { reminderLeadMinutes: next }),
    onSuccess: () => { toast.success(L('Délais de rappel enregistrés')); queryClient.invalidateQueries({ queryKey: ['cabinet', cabinet.id] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const toggle = (value: number) => {
    const next = leads.includes(value) ? leads.filter(v => v !== value) : [...leads, value]
    if (!next.length) return
    setLeads(next)
    save.mutate(next)
  }
  return (
    <section className="space-y-2 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
      <h3 className="font-bold">{L('Quand envoyer les rappels ?')}</h3>
      <div className="flex flex-wrap gap-2">
        {LEADS.map(l => (
          <button key={l.value} type="button" aria-pressed={leads.includes(l.value)} onClick={() => toggle(l.value)}
            className={cn('rounded-xl border px-3 py-2 text-sm font-semibold', leads.includes(l.value) ? 'border-primary bg-accent text-primary' : 'border-border')}>{L(l.label)}</button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{L('Les messages indiquent seulement le cabinet, le praticien, la date et l’heure : jamais de diagnostic ni de traitement. Seuls les patients ayant donné leur accord sont contactés.')} {L('Quota mensuel de votre plan :')} {cabinet.monthlyMessages} {L('messages')}.</p>
    </section>
  )
}

const emptyAct = { code: '', name: '', price: '0', category: 'Soins', ngap: '', scope: 'NONE' as ActScope, usesFaces: false, resultingState: '' as '' | ToothStateCode, specialty: 'DENTISTRY' }
const ALL_SPECIALTIES = ['DENTISTRY', 'GENERAL', 'PEDIATRICS', 'GYNECOLOGY', 'OPHTHALMOLOGY', 'CARDIOLOGY', 'DERMATOLOGY', 'PHYSIOTHERAPY', 'PSYCHIATRY']

function ActsCatalogue({ cabinet }: { cabinet: Cabinet }) {
  const L = useL()
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Act | 'new' | null>(null)
  const [form, setForm] = useState(emptyAct)
  // Specialty shown in the table (a cabinet can have several).
  const [spec, setSpec] = useState<string>(cabinet.specialty)
  const { data: acts = [] } = useQuery({ queryKey: ['acts', cabinetApi, 'all'], queryFn: async () => (await api.get(`${cabinetApi}/acts`, { params: { all: 'true' } })).data.data as Act[] })
  useEffect(() => {
    if (!editing) return
    setForm(editing === 'new' ? { ...emptyAct, specialty: spec } : { code: editing.code, name: editing.name, price: String(Number(editing.price)), category: editing.category, ngap: editing.ngap || '', scope: editing.scope, usesFaces: editing.usesFaces, resultingState: editing.resultingState || '', specialty: editing.specialty })
  }, [editing, spec])
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['acts'] })
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, price: Number(form.price), ngap: form.ngap.trim() || null, resultingState: form.resultingState || null }
      return editing === 'new' ? api.post(`${cabinetApi}/acts`, body) : api.patch(`${cabinetApi}/acts/${(editing as Act).id}`, body)
    },
    onSuccess: () => { toast.success(L('Catalogue mis à jour')); setEditing(null); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const toggle = useMutation({
    mutationFn: (act: Act) => api.patch(`${cabinetApi}/acts/${act.id}`, { isActive: !act.isActive }),
    onSuccess: refresh,
  })
  // Price changed directly in the table (saved on Enter or when leaving the field).
  const setPrice = useMutation({
    mutationFn: ({ act, price }: { act: Act; price: number }) => api.patch(`${cabinetApi}/acts/${act.id}`, { price }),
    onSuccess: () => { toast.success(L('Tarif enregistré')); refresh() },
    onError: (err) => { toast.error(apiError(err)); refresh() },
  })
  const savePrice = (act: Act, raw: string) => {
    const price = Number(raw.replace(',', '.'))
    if (raw.trim() === '' || !(price >= 0) || price === Number(act.price)) return
    setPrice.mutate({ act, price })
  }
  // Specialties of the cabinet: its own, its doctors' and those already in the catalogue.
  const { data: team = [] } = useTeam()
  const specialties = [...new Set([cabinet.specialty, ...team.map(m => m.specialty).filter(Boolean) as string[], ...acts.map(a => a.specialty)])]
    .filter(sp => ALL_SPECIALTIES.includes(sp))
  const [search, setSearch] = useState('')
  const plain = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const shown = acts.filter(a => a.specialty === spec && (!search.trim() || plain(`${a.code} ${a.name} ${a.category}`).includes(plain(search.trim()))))
  const categories = [...new Set(shown.map(a => a.category))]
  const importDefaults = useMutation({
    mutationFn: async () => (await api.post(`${cabinetApi}/acts/import-defaults`, { specialty: spec })).data as { message: string },
    onSuccess: (res) => { toast.success(L(res.message)); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const set = (key: keyof typeof emptyAct) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">{L('Les actes et tarifs de votre cabinet, utilisés pour les factures, les devis et les actes. Vos changements ne concernent que votre cabinet.')}</p>
      {specialties.length > 1 && (
        <div role="tablist" aria-label={L('Spécialité')} className="flex flex-wrap gap-1.5">
          {specialties.map(sp => (
            <button key={sp} type="button" role="tab" aria-selected={spec === sp} onClick={() => setSpec(sp)}
              className={cn('rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold', spec === sp ? 'bg-primary text-white' : 'bg-white text-[#3F514A] ring-1 ring-[#D8E1DD] hover:text-primary')}>
              {t(`specialty.${sp}`)} <span className="opacity-70">({acts.filter(x => x.specialty === sp).length})</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-10 w-full sm:w-72" placeholder={L('Rechercher un acte…')} aria-label={L('Rechercher un acte')} value={search} onChange={e => setSearch(e.target.value)} />
        <div className="ms-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={importDefaults.isPending} onClick={() => importDefaults.mutate()}>{L('Ajouter les actes par défaut manquants')}</Button>
          <Button size="sm" onClick={() => setEditing('new')}><Plus size={16} className="me-1" />{L('Acte')}</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-[14px] border border-[#D8E1DD] bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3 text-start">{L('Acte')}</th><th className="p-3 text-start">{L('Code')}</th><th className="p-3 text-start">{L('NGAP')}</th><th className="w-40 p-3 text-end">{L('Tarif')} ({cabinet.currency})</th><th className="p-3 text-start">{L('Actif')}</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{search ? L('Aucun acte trouvé.') : L('Aucun acte pour cette spécialité : ajoutez les actes par défaut ou créez les vôtres.')}</td></tr>}
            {categories.map(cat => [
              <tr key={`c-${cat}`} className="border-t border-border bg-[#F7F9F8]"><td colSpan={5} className="px-3 py-1.5 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-[#5A6B65]">{cat}</td></tr>,
              ...shown.filter(a => a.category === cat).map(act => (
                <tr key={act.id} className={cn('border-t border-border', !act.isActive && 'opacity-50')}>
                  <td className="p-3"><button type="button" className="text-start font-medium hover:underline" onClick={() => setEditing(act)}>{act.name}</button>{act.resultingState && <span className="ms-2 text-xs text-muted-foreground">→ {t(`toothState.${act.resultingState}`)}</span>}</td>
                  <td className="p-3 font-mono text-[0.8rem] text-primary">{act.code}</td>
                  <td className="p-3 font-mono">{act.ngap || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-2 text-end">
                    <Input key={`${act.id}-${String(act.price)}`} type="number" min={0} step="0.01" inputMode="decimal" aria-label={`${L('Tarif')} ${act.name}`} className="h-9 text-end font-semibold"
                      defaultValue={Number(act.price)} onBlur={e => savePrice(act, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  </td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={act.isActive} onChange={() => toggle.mutate(act)} aria-label={`${L('Activer')} ${act.name}`} /></td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing === 'new' ? L('Nouvel acte') : L('Modifier l’acte')}</DialogTitle></DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); save.mutate() }}>
            <div className="space-y-1.5"><Label htmlFor="a-code">{L('Code')}</Label><Input id="a-code" value={form.code} onChange={set('code')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="a-price">{L('Tarif')}</Label><Input id="a-price" type="number" min={0} step="0.01" value={form.price} onChange={set('price')} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="a-name">{L('Libellé')}</Label><Input id="a-name" value={form.name} onChange={set('name')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="a-cat">{L('Catégorie')}</Label><Input id="a-cat" value={form.category} onChange={set('category')} /></div>
            <div className="space-y-1.5"><Label htmlFor="a-spec">{L('Spécialité')}</Label><NativeSelect id="a-spec" value={form.specialty} onChange={set('specialty')}>{ALL_SPECIALTIES.map(s => <option key={s} value={s}>{t(`specialty.${s}`)}</option>)}</NativeSelect></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="a-ngap">{L('Cotation NGAP (lettre clé et coefficient)')}</Label><Input id="a-ngap" value={form.ngap} onChange={set('ngap')} placeholder={L('ex. C, CS, D 30, K 20')} /><p className="text-xs text-muted-foreground">{L('Reportée sur la feuille de soins CNSS.')}</p></div>
            {form.specialty === 'DENTISTRY' && <>
              <div className="space-y-1.5"><Label htmlFor="a-scope">{L('Porte sur')}</Label>
                <NativeSelect id="a-scope" value={form.scope} onChange={set('scope')}><option value="NONE">{L('Rien de précis')}</option><option value="TOOTH">{L('Une dent')}</option><option value="TEETH">{L('Plusieurs dents')}</option><option value="QUADRANT">{L('Un quadrant')}</option><option value="MOUTH">{L('Toute la bouche')}</option></NativeSelect>
              </div>
              <div className="space-y-1.5"><Label htmlFor="a-state">{L('État de la dent après l’acte')}</Label>
                <NativeSelect id="a-state" value={form.resultingState} onChange={set('resultingState')}><option value="">{L('Inchangé')}</option>{TOOTH_STATE_CODES.map(s => <option key={s} value={s}>{t(`toothState.${s}`)}</option>)}</NativeSelect>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={form.usesFaces} onChange={set('usesFaces')} />{L('L’acte concerne des faces (M, D, O…)')}</label>
            </>}
            <Button type="submit" className="sm:col-span-2" disabled={save.isPending}>{L('Enregistrer')}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

type Grant = { id: string; readOnly: boolean; reason: string | null; expiresAt: string; revokedAt: string | null; createdAt: string }
type AccessEntry = { id: string; action: string; detail: string | null; createdAt: string; user: { firstName: string; lastName: string; role: string } | null; patient: { firstName: string; lastName: string } | null }

function Privacy() {
  const L = useL()
  const { t } = useTranslation()
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const [hours, setHours] = useState('24')
  const [action, setAction] = useState('')
  const { data: grants = [] } = useQuery({ queryKey: ['support-grants'], queryFn: async () => (await api.get(`${cabinetApi}/support-grants`)).data.data as Grant[] })
  const { data: log = [] } = useQuery({ queryKey: ['access-log', action], queryFn: async () => (await api.get(`${cabinetApi}/access-log`, { params: { action: action || undefined } })).data.data as AccessEntry[] })
  const grant = useMutation({
    mutationFn: () => api.post(`${cabinetApi}/support-grants`, { hours: Number(hours), readOnly: true }),
    onSuccess: () => { toast.success(L('Accès support autorisé')); queryClient.invalidateQueries({ queryKey: ['support-grants'] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`${cabinetApi}/support-grants/${id}`),
    onSuccess: () => { toast.success(L('Accès révoqué')); queryClient.invalidateQueries({ queryKey: ['support-grants'] }) },
  })
  const active = grants.find(g => !g.revokedAt && new Date(g.expiresAt) > new Date())
  // Support (Super Admin) visits are recorded in the platform audit log only; the cabinet's log lists its own team.
  const ACTIONS: Record<string, string> = { VIEW_RECORD: 'Fiche consultée', VIEW_MEDICAL: 'Dossier médical consulté', DENIED: 'Accès refusé', ...(user?.role === 'SUPER_ADMIN' ? { SUPPORT_VIEW: 'Consultation par le support' } : {}) }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
        <h3 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} className="text-primary" />{L('Accès du support technique')}</h3>
        <p className="text-sm text-muted-foreground">{L('L’équipe Cabinet Pro ne voit aucun dossier de votre cabinet sans votre autorisation. L’accès est limité dans le temps, en lecture seule, et vous pouvez le révoquer à tout moment.')}</p>
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent p-3 text-sm">
            <span>{L('Accès autorisé jusqu’au')} <b>{formatDateTimeFR(active.expiresAt)}</b> {L('(lecture seule)')}</span>
            <Button size="sm" variant="outline" onClick={() => revoke.mutate(active.id)}>{L('Révoquer maintenant')}</Button>
          </div>
        ) : user?.role === 'OWNER' ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5"><Label htmlFor="g-hours">{L('Durée')}</Label><NativeSelect id="g-hours" className="w-auto" value={hours} onChange={e => setHours(e.target.value)}><option value="2">{L('2 heures')}</option><option value="24">{L('24 heures')}</option><option value="72">{L('72 heures')}</option></NativeSelect></div>
            <Button onClick={() => grant.mutate()} disabled={grant.isPending}>{L('Autoriser l’accès support')}</Button>
          </div>
        ) : <p className="text-sm">{L('Aucun accès support actif.')}</p>}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">{L('Journal des accès aux dossiers')}</h3>
          <NativeSelect className="w-auto" aria-label={L('Filtrer')} value={action} onChange={e => setAction(e.target.value)}>
            <option value="">{L('Tous les accès')}</option>
            {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </div>
        <div className="overflow-x-auto rounded-[14px] border border-[#D8E1DD] bg-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3 text-start">{L('Date')}</th><th className="p-3 text-start">{L('Utilisateur')}</th><th className="p-3 text-start">{L('Patient')}</th><th className="p-3 text-start">{L('Action')}</th></tr></thead>
            <tbody>
              {log.map(entry => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap">{formatDateTimeFR(entry.createdAt)}</td>
                  <td className="p-3">{entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : '—'}<span className="block text-xs text-muted-foreground">{entry.user ? t(`roles.${entry.user.role}`) : ''}</span></td>
                  <td className="p-3">{entry.patient ? `${entry.patient.lastName} ${entry.patient.firstName}` : '—'}</td>
                  <td className="p-3"><Badge variant={entry.action === 'DENIED' ? 'destructive' : entry.action === 'SUPPORT_VIEW' ? 'warning' : 'secondary'}>{L(ACTIONS[entry.action] || entry.action)}</Badge>{entry.detail && <span className="block text-xs text-muted-foreground">{entry.detail}</span>}</td>
                </tr>
              ))}
              {log.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{L('Aucun accès enregistré.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function Settings() {
  const L = useL()
  const { t } = useTranslation()
  const cabinetId = useCabinetId()
  const [searchParams] = useSearchParams()
  const asked = searchParams.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(asked && ['cabinet', 'acts', 'booking', 'reminders', 'privacy'].includes(asked) ? asked : 'cabinet')
  const { data: cabinet } = useQuery({ queryKey: ['cabinet', cabinetId], queryFn: async () => (await api.get(`/cabinets/${cabinetId}`)).data.data as Cabinet, enabled: !!cabinetId })
  const tabs: { key: Tab; label: string }[] = [
    { key: 'cabinet', label: L('Cabinet') }, { key: 'acts', label: L('Actes et tarifs') }, { key: 'booking', label: L('Rendez-vous en ligne') }, { key: 'reminders', label: L('Rappels') }, { key: 'privacy', label: L('Confidentialité') },
  ]
  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.settings')} subtitle={cabinet ? `${cabinet.name} · ${t(`specialty.${cabinet.specialty}`)}` : undefined} />
      <div role="tablist" className="flex flex-wrap gap-1">
        {tabs.map(x => <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)} className={cn('rounded-xl px-3.5 py-2 text-sm font-semibold', tab === x.key ? 'bg-primary text-white' : 'bg-white text-muted-foreground ring-1 ring-border')}>{x.label}</button>)}
      </div>
      {cabinet && tab === 'cabinet' && <CabinetInfo cabinet={cabinet} />}
      {cabinet && tab === 'acts' && <ActsCatalogue cabinet={cabinet} />}
      {cabinet && tab === 'booking' && <OnlineBookingCard cabinet={cabinet} />}
      {cabinet && tab === 'reminders' && <div className="space-y-4"><ReminderLeads cabinet={cabinet} /><RemindersCard cabinet={cabinet} /></div>}
      {cabinet && tab === 'privacy' && <Privacy />}
    </div>
  )
}
