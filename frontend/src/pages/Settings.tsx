import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, ShieldCheck } from 'lucide-react'
import api from '../lib/api'
import { apiError, useAuth, useCabinetApi, useCabinetId } from '../lib/hooks'
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
import { TOOTH_STATE_CODES } from '../components/dental/Odontogram'

type Tab = 'cabinet' | 'acts' | 'reminders' | 'privacy'

const LEADS = [{ value: 1440, label: 'La veille (24 h avant)' }, { value: 120, label: '2 h avant' }, { value: 60, label: '1 h avant' }]

function CabinetInfo({ cabinet }: { cabinet: Cabinet }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '', email: '', letterhead: '' })
  useEffect(() => setForm({ name: cabinet.name, address: cabinet.address || '', city: cabinet.city || '', phone: cabinet.phone || '', email: cabinet.email || '', letterhead: cabinet.letterhead || '' }), [cabinet])
  const save = useMutation({
    mutationFn: () => api.patch(`/cabinets/${cabinet.id}`, { ...form, address: form.address || null, city: form.city || null, phone: form.phone || null, email: form.email || null, letterhead: form.letterhead || null }),
    onSuccess: () => { toast.success('Cabinet mis à jour'); queryClient.invalidateQueries({ queryKey: ['cabinet', cabinet.id] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value }))
  return (
    <form className="grid gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); save.mutate() }}>
      <div className="space-y-1.5"><Label htmlFor="s-name">Nom du cabinet</Label><Input id="s-name" value={form.name} onChange={set('name')} required /></div>
      <div className="space-y-1.5"><Label htmlFor="s-phone">Téléphone (affiché dans les rappels)</Label><Input id="s-phone" value={form.phone} onChange={set('phone')} /></div>
      <div className="space-y-1.5"><Label htmlFor="s-address">Adresse</Label><Input id="s-address" value={form.address} onChange={set('address')} /></div>
      <div className="space-y-1.5"><Label htmlFor="s-city">Ville</Label><Input id="s-city" value={form.city} onChange={set('city')} /></div>
      <div className="space-y-1.5"><Label htmlFor="s-email">Email</Label><Input id="s-email" type="email" value={form.email} onChange={set('email')} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-letterhead">En-tête des ordonnances et factures</Label><Textarea id="s-letterhead" rows={4} value={form.letterhead} onChange={set('letterhead')} placeholder={'Dr … — Chirurgien-dentiste\nDiplômé(e) de …\nINPE : …'} /></div>
      <Button type="submit" className="sm:col-span-2 sm:w-fit" disabled={save.isPending}>Enregistrer</Button>
    </form>
  )
}

function ReminderLeads({ cabinet }: { cabinet: Cabinet }) {
  const queryClient = useQueryClient()
  const [leads, setLeads] = useState<number[]>(cabinet.reminderLeadMinutes || [1440, 60])
  const save = useMutation({
    mutationFn: (next: number[]) => api.patch(`/cabinets/${cabinet.id}`, { reminderLeadMinutes: next }),
    onSuccess: () => { toast.success('Délais de rappel enregistrés'); queryClient.invalidateQueries({ queryKey: ['cabinet', cabinet.id] }) },
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
      <h3 className="font-bold">Quand envoyer les rappels ?</h3>
      <div className="flex flex-wrap gap-2">
        {LEADS.map(l => (
          <button key={l.value} type="button" aria-pressed={leads.includes(l.value)} onClick={() => toggle(l.value)}
            className={cn('rounded-xl border px-3 py-2 text-sm font-semibold', leads.includes(l.value) ? 'border-primary bg-accent text-primary' : 'border-border')}>{l.label}</button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Les messages indiquent seulement le cabinet, le praticien, la date et l’heure : jamais de diagnostic ni de traitement. Seuls les patients ayant donné leur accord sont contactés. Quota mensuel de votre plan : {cabinet.monthlyMessages} messages.</p>
    </section>
  )
}

const emptyAct = { code: '', name: '', price: '0', category: 'Soins', ngap: '', scope: 'NONE' as ActScope, usesFaces: false, resultingState: '' as '' | ToothStateCode, specialty: 'DENTISTRY' }
const ALL_SPECIALTIES = ['DENTISTRY', 'GENERAL', 'PEDIATRICS', 'GYNECOLOGY', 'OPHTHALMOLOGY', 'CARDIOLOGY', 'DERMATOLOGY', 'PHYSIOTHERAPY', 'PSYCHIATRY']

function ActsCatalogue({ cabinet }: { cabinet: Cabinet }) {
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Act | 'new' | null>(null)
  const [form, setForm] = useState(emptyAct)
  const { data: acts = [] } = useQuery({ queryKey: ['acts', cabinetApi, 'all'], queryFn: async () => (await api.get(`${cabinetApi}/acts`, { params: { all: 'true' } })).data.data as Act[] })
  useEffect(() => {
    if (!editing) return
    setForm(editing === 'new' ? { ...emptyAct, specialty: cabinet.specialty } : { code: editing.code, name: editing.name, price: String(Number(editing.price)), category: editing.category, ngap: editing.ngap || '', scope: editing.scope, usesFaces: editing.usesFaces, resultingState: editing.resultingState || '', specialty: editing.specialty })
  }, [editing, cabinet.specialty])
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['acts'] })
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, price: Number(form.price), ngap: form.ngap.trim() || null, resultingState: form.resultingState || null }
      return editing === 'new' ? api.post(`${cabinetApi}/acts`, body) : api.patch(`${cabinetApi}/acts/${(editing as Act).id}`, body)
    },
    onSuccess: () => { toast.success('Catalogue mis à jour'); setEditing(null); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const toggle = useMutation({
    mutationFn: (act: Act) => api.patch(`${cabinetApi}/acts/${act.id}`, { isActive: !act.isActive }),
    onSuccess: refresh,
  })
  const set = (key: keyof typeof emptyAct) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Tarifs utilisés pour les actes, les factures et les devis.</p><Button size="sm" onClick={() => setEditing('new')}><Plus size={16} className="me-1" />Acte</Button></div>
      <div className="overflow-x-auto rounded-[14px] border border-[#D8E1DD] bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3 text-start">Code</th><th className="p-3 text-start">Acte</th><th className="p-3 text-start">Catégorie</th><th className="p-3 text-start">NGAP</th><th className="p-3 text-end">Tarif</th><th className="p-3 text-start">Actif</th></tr></thead>
          <tbody>
            {acts.map(act => (
              <tr key={act.id} className={cn('border-t border-border', !act.isActive && 'opacity-50')}>
                <td className="p-3 font-mono text-primary">{act.code}</td>
                <td className="p-3"><button type="button" className="text-start hover:underline" onClick={() => setEditing(act)}>{act.name}</button>{act.resultingState && <span className="ms-2 text-xs text-muted-foreground">→ {t(`toothState.${act.resultingState}`)}</span>}</td>
                <td className="p-3">{act.category}</td>
                <td className="p-3 font-mono">{act.ngap || <span className="text-muted-foreground">—</span>}</td>
                <td className="p-3 text-end font-semibold">{formatCurrency(act.price, cabinet.currency)}</td>
                <td className="p-3"><input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={act.isActive} onChange={() => toggle.mutate(act)} aria-label={`Activer ${act.name}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Nouvel acte' : 'Modifier l’acte'}</DialogTitle></DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); save.mutate() }}>
            <div className="space-y-1.5"><Label htmlFor="a-code">Code</Label><Input id="a-code" value={form.code} onChange={set('code')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="a-price">Tarif</Label><Input id="a-price" type="number" min={0} step="0.01" value={form.price} onChange={set('price')} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="a-name">Libellé</Label><Input id="a-name" value={form.name} onChange={set('name')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="a-cat">Catégorie</Label><Input id="a-cat" value={form.category} onChange={set('category')} /></div>
            <div className="space-y-1.5"><Label htmlFor="a-spec">Spécialité</Label><NativeSelect id="a-spec" value={form.specialty} onChange={set('specialty')}>{ALL_SPECIALTIES.map(s => <option key={s} value={s}>{t(`specialty.${s}`)}</option>)}</NativeSelect></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="a-ngap">Cotation NGAP (lettre clé et coefficient)</Label><Input id="a-ngap" value={form.ngap} onChange={set('ngap')} placeholder="ex. C, CS, D 30, K 20" /><p className="text-xs text-muted-foreground">Reportée sur la feuille de soins CNSS.</p></div>
            {form.specialty === 'DENTISTRY' && <>
              <div className="space-y-1.5"><Label htmlFor="a-scope">Porte sur</Label>
                <NativeSelect id="a-scope" value={form.scope} onChange={set('scope')}><option value="NONE">Rien de précis</option><option value="TOOTH">Une dent</option><option value="TEETH">Plusieurs dents</option><option value="QUADRANT">Un quadrant</option><option value="MOUTH">Toute la bouche</option></NativeSelect>
              </div>
              <div className="space-y-1.5"><Label htmlFor="a-state">État de la dent après l’acte</Label>
                <NativeSelect id="a-state" value={form.resultingState} onChange={set('resultingState')}><option value="">Inchangé</option>{TOOTH_STATE_CODES.map(s => <option key={s} value={s}>{t(`toothState.${s}`)}</option>)}</NativeSelect>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={form.usesFaces} onChange={set('usesFaces')} />L’acte concerne des faces (M, D, O…)</label>
            </>}
            <Button type="submit" className="sm:col-span-2" disabled={save.isPending}>Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

type Grant = { id: string; readOnly: boolean; reason: string | null; expiresAt: string; revokedAt: string | null; createdAt: string }
type AccessEntry = { id: string; action: string; detail: string | null; createdAt: string; user: { firstName: string; lastName: string; role: string } | null; patient: { firstName: string; lastName: string } | null }

function Privacy() {
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
    onSuccess: () => { toast.success('Accès support autorisé'); queryClient.invalidateQueries({ queryKey: ['support-grants'] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`${cabinetApi}/support-grants/${id}`),
    onSuccess: () => { toast.success('Accès révoqué'); queryClient.invalidateQueries({ queryKey: ['support-grants'] }) },
  })
  const active = grants.find(g => !g.revokedAt && new Date(g.expiresAt) > new Date())
  // Support (Super Admin) visits are recorded in the platform audit log only; the cabinet's log lists its own team.
  const ACTIONS: Record<string, string> = { VIEW_RECORD: 'Fiche consultée', VIEW_MEDICAL: 'Dossier médical consulté', DENIED: 'Accès refusé', ...(user?.role === 'SUPER_ADMIN' ? { SUPPORT_VIEW: 'Consultation par le support' } : {}) }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
        <h3 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} className="text-primary" />Accès du support technique</h3>
        <p className="text-sm text-muted-foreground">L’équipe Cabinet Pro ne voit aucun dossier de votre cabinet sans votre autorisation. L’accès est limité dans le temps, en lecture seule, et vous pouvez le révoquer à tout moment.</p>
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent p-3 text-sm">
            <span>Accès autorisé jusqu’au <b>{formatDateTimeFR(active.expiresAt)}</b> (lecture seule)</span>
            <Button size="sm" variant="outline" onClick={() => revoke.mutate(active.id)}>Révoquer maintenant</Button>
          </div>
        ) : user?.role === 'OWNER' ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5"><Label htmlFor="g-hours">Durée</Label><NativeSelect id="g-hours" className="w-auto" value={hours} onChange={e => setHours(e.target.value)}><option value="2">2 heures</option><option value="24">24 heures</option><option value="72">72 heures</option></NativeSelect></div>
            <Button onClick={() => grant.mutate()} disabled={grant.isPending}>Autoriser l’accès support</Button>
          </div>
        ) : <p className="text-sm">Aucun accès support actif.</p>}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Journal des accès aux dossiers</h3>
          <NativeSelect className="w-auto" aria-label="Filtrer" value={action} onChange={e => setAction(e.target.value)}>
            <option value="">Tous les accès</option>
            {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </div>
        <div className="overflow-x-auto rounded-[14px] border border-[#D8E1DD] bg-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3 text-start">Date</th><th className="p-3 text-start">Utilisateur</th><th className="p-3 text-start">Patient</th><th className="p-3 text-start">Action</th></tr></thead>
            <tbody>
              {log.map(entry => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap">{formatDateTimeFR(entry.createdAt)}</td>
                  <td className="p-3">{entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : '—'}<span className="block text-xs text-muted-foreground">{entry.user ? t(`roles.${entry.user.role}`) : ''}</span></td>
                  <td className="p-3">{entry.patient ? `${entry.patient.lastName} ${entry.patient.firstName}` : '—'}</td>
                  <td className="p-3"><Badge variant={entry.action === 'DENIED' ? 'destructive' : entry.action === 'SUPPORT_VIEW' ? 'warning' : 'secondary'}>{ACTIONS[entry.action] || entry.action}</Badge>{entry.detail && <span className="block text-xs text-muted-foreground">{entry.detail}</span>}</td>
                </tr>
              ))}
              {log.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Aucun accès enregistré.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const cabinetId = useCabinetId()
  const [tab, setTab] = useState<Tab>('cabinet')
  const { data: cabinet } = useQuery({ queryKey: ['cabinet', cabinetId], queryFn: async () => (await api.get(`/cabinets/${cabinetId}`)).data.data as Cabinet, enabled: !!cabinetId })
  const tabs: { key: Tab; label: string }[] = [
    { key: 'cabinet', label: 'Cabinet' }, { key: 'acts', label: 'Actes et tarifs' }, { key: 'reminders', label: 'Rappels' }, { key: 'privacy', label: 'Confidentialité' },
  ]
  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.settings')} subtitle={cabinet ? `${cabinet.name} · ${t(`specialty.${cabinet.specialty}`)}` : undefined} />
      <div role="tablist" className="flex flex-wrap gap-1">
        {tabs.map(x => <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)} className={cn('rounded-xl px-3.5 py-2 text-sm font-semibold', tab === x.key ? 'bg-primary text-white' : 'bg-white text-muted-foreground ring-1 ring-border')}>{x.label}</button>)}
      </div>
      {cabinet && tab === 'cabinet' && <CabinetInfo cabinet={cabinet} />}
      {cabinet && tab === 'acts' && <ActsCatalogue cabinet={cabinet} />}
      {cabinet && tab === 'reminders' && <div className="space-y-4"><ReminderLeads cabinet={cabinet} /><RemindersCard cabinet={cabinet} /></div>}
      {cabinet && tab === 'privacy' && <Privacy />}
    </div>
  )
}
