import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Building2, CalendarClock, Eye, MessageCircle, MessageSquareText, MoreHorizontal, Plus, RotateCcw, Search, ShieldCheck, Trash2, Users } from 'lucide-react'
import api from '../lib/api'
import { apiError } from '../lib/hooks'
import { cn, formatCurrency, formatDateFR, formatDateTimeFR } from '../lib/utils'
import { Cabinet, Plan, SaasMetrics, Specialty } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { whatsappLink } from './SubscriptionBlocked'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { NativeSelect } from '../components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { SubscriptionDialog, SubscriptionTarget } from '../components/SubscriptionDialog'
import { SaasSection } from '../components/dashboard/SaasSection'

const SPECIALTIES: Specialty[] = ['DENTISTRY', 'GENERAL', 'PEDIATRICS', 'GYNECOLOGY', 'OPHTHALMOLOGY', 'CARDIOLOGY', 'DERMATOLOGY', 'PHYSIOTHERAPY', 'PSYCHIATRY']
type StatusKey = 'active' | 'trial' | 'expired' | 'suspended'
const STATUS_LABEL: Record<StatusKey | 'all', { label: string; pill: string }> = {
  all: { label: 'Tous', pill: '' },
  active: { label: 'Actif', pill: 'bg-[#DFF1E6] text-[#1E7A45]' },
  trial: { label: 'Essai', pill: 'bg-[#E1E9F7] text-[#2D5DAA]' },
  expired: { label: 'Expiré', pill: 'bg-[#FBE3E0] text-[#B8372C]' },
  suspended: { label: 'Suspendu', pill: 'bg-[#FBE3E0] text-[#B8372C]' },
}
const statusOf = (c: Cabinet): StatusKey => {
  if (c.isActive === false || c.subscriptionStatus === 'SUSPENDED') return 'suspended'
  if (c.subscriptionStatus === 'PAST_DUE' || c.subscriptionStatus === 'CANCELLED') return 'expired'
  if (c.currentPeriodEnd && new Date(c.currentPeriodEnd).getTime() < Date.now()) return 'expired'
  return c.subscriptionStatus === 'TRIALING' ? 'trial' : 'active'
}
const relative = (date: string | null) => {
  if (!date) return ''
  const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000)
  return days === 0 ? 'aujourd’hui' : days > 0 ? `dans ${days} j` : `il y a ${-days} j`
}

const emptyForm = { name: '', specialty: 'DENTISTRY' as Specialty, city: '', phone: '', email: '', plan: '', ownerFirstName: '', ownerLastName: '', ownerEmail: '', ownerPhone: '', ownerPassword: '' }

/** F-SA-01: cabinets, their specialty, plan and quotas. Real cabinets open only with the owner's support grant (F-SA-04). */
export default function CabinetList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusKey | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [managed, setManaged] = useState<SubscriptionTarget | null>(null)
  const [showMetrics, setShowMetrics] = useState(false)

  const { data: cabinets = [], isLoading } = useQuery({ queryKey: ['all-cabinets'], queryFn: async () => (await api.get('/cabinets')).data.data as Cabinet[] })
  const { data: metrics } = useQuery({ queryKey: ['saas-metrics'], queryFn: async () => (await api.get('/cabinets/saas-metrics')).data.data as SaasMetrics })
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/plans')).data.data as Plan[] })

  const filtered = useMemo(() => cabinets.filter(c =>
    !search || [c.name, c.city, c.email, c.phone, t(`specialty.${c.specialty}`)].some(v => v?.toLowerCase().includes(search.toLowerCase()))), [cabinets, search, t])

  const refresh = () => ['all-cabinets', 'saas-metrics', 'subscription-alerts'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
  const create = useMutation({
    mutationFn: () => api.post('/cabinets', {
      name: form.name, specialty: form.specialty, city: form.city || undefined, phone: form.phone || undefined, email: form.email || null, plan: form.plan,
      owner: form.ownerEmail ? { email: form.ownerEmail, password: form.ownerPassword, firstName: form.ownerFirstName, lastName: form.ownerLastName, phone: form.ownerPhone || undefined } : undefined,
    }),
    onSuccess: () => { toast.success('Cabinet créé et abonnement activé'); setCreating(false); setForm(emptyForm); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const toggle = useMutation({
    mutationFn: async (c: Cabinet) => {
      if (c.isActive === false) await api.patch(`/cabinets/${c.id}/subscription`, { plan: c.plan, subscriptionStatus: 'ACTIVE' })
      else await api.patch(`/cabinets/${c.id}/status`, { isActive: false })
    },
    onSuccess: () => { toast.success('Statut mis à jour'); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const resetDemo = useMutation({
    mutationFn: () => api.post('/cabinets/demo/reset'),
    onSuccess: () => { toast.success('Démo remise à zéro, avec un planning daté d’aujourd’hui'); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/cabinets/${id}`),
    onSuccess: () => { toast.success('Cabinet supprimé'); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value }))
  const canOpen = (c: Cabinet) => c.isDemo || !!c.supportAccess
  const open = (c: Cabinet) => navigate(`/today?cabinetId=${c.id}`)
  const demo = cabinets.find(c => c.isDemo)
  const real = filtered.filter(c => !c.isDemo && (status === 'all' || statusOf(c) === status))

  // One list of what needs the Super Admin today: plans that just ended, trials ending, renewals due.
  const attention = metrics ? [
    ...metrics.recentlyExpired.map(c => ({ c, why: `Terminé ${relative(c.currentPeriodEnd)}`, tone: 'text-[#B8372C]' })),
    ...metrics.trialsEndingSoon.map(c => ({ c, why: `Essai : fin ${relative(c.currentPeriodEnd)}`, tone: 'text-[#99600B]' })),
    ...metrics.renewalsDueSoon.map(c => ({ c, why: `Renouvellement ${relative(c.currentPeriodEnd)}`, tone: 'text-[#5A6B65]' })),
  ] : []

  return (
    <div className="grid gap-5">
      <PageHeader title={t('nav.allCabinets')} subtitle={`${cabinets.filter(c => !c.isDemo).length} cabinet(s)`}
        actions={<Button onClick={() => { setForm({ ...emptyForm, plan: plans.find(p => p.isActive && p.code !== 'TRIAL')?.code || '' }); setCreating(true) }}><Plus size={17} className="me-1.5" />Nouveau cabinet</Button>} />

      {metrics && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            ['Cabinets payants', String(metrics.counts.paying), false],
            ['En essai', String(metrics.counts.trialing), false],
            ['Revenu mensuel', formatCurrency(metrics.mrr), false],
            ['Expirés ou suspendus', String(metrics.counts.expired + metrics.counts.suspended), metrics.counts.expired + metrics.counts.suspended > 0],
          ] as [string, string, boolean][]).map(([label, value, warn]) => (
            <div key={label} className="grid gap-0.5 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3.5">
              <span className="text-[0.86rem] text-[#5A6B65]">{label}</span>
              <b className={cn('text-[1.4rem] font-extrabold tabular-nums tracking-[-0.02em]', warn && 'text-[#B8372C]')}>{value}</b>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-[14px] border border-[#D8E1DD] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] pb-2.5 pt-4">
          <h2 className="text-[1.08rem] font-bold">À traiter</h2>
          <Button size="sm" variant="ghost" onClick={() => setShowMetrics(v => !v)}>{showMetrics ? 'Masquer les chiffres détaillés' : 'Chiffres détaillés'}</Button>
        </div>
        {attention.length === 0 ? <p className="px-[18px] pb-6 pt-2 text-center text-[#5A6B65]">Rien à traiter aujourd’hui.</p> : attention.map(({ c, why, tone }) => (
          <div key={`${c.id}-${why}`} className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-t border-[#D8E1DD] px-4 py-3 sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:px-[18px]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9EFEC] text-primary"><Building2 size={18} /></span>
            <div className="min-w-0"><b className="block truncate font-semibold">{c.name}</b><span className={cn('text-[0.86rem]', tone)}>{why} · {c.plan}</span></div>
            <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
              {c.phone && <Button asChild size="sm" variant="outline"><a href={whatsappLink(c.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} className="me-1" />WhatsApp</a></Button>}
              <Button size="sm" onClick={() => setManaged(c)}>Gérer l’abonnement</Button>
            </div>
          </div>
        ))}
      </section>

      {showMetrics && <SaasSection />}

      {demo && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-[#EEE7F8] px-[18px] py-4 text-[#6746A8]">
          <div><b className="block text-[1.02rem]">Cabinet de démonstration</b><span className="text-[0.9rem]">Patients fictifs, pour les démos et la formation. Remise à jour chaque nuit avec un planning du jour.</span></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={resetDemo.isPending} onClick={() => resetDemo.mutate()} title="Efface ce qui a été saisi pendant les démos et recrée des patients fictifs">
              <RotateCcw size={15} className={cn('me-1', resetDemo.isPending && 'animate-spin')} />{resetDemo.isPending ? 'Remise à zéro…' : 'Remettre à zéro'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/users?cabinetId=${demo.id}`)}><Users size={15} className="me-1" />Comptes de démo</Button>
            <Button size="sm" className="bg-[#6746A8] hover:bg-[#553990]" onClick={() => open(demo)}><Eye size={15} className="me-1" />Ouvrir la démo</Button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, ville, spécialité…" aria-label="Rechercher" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_LABEL) as (StatusKey | 'all')[]).map(key => (
            <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(key)}
              className={cn('rounded-full border px-3 py-1.5 text-[0.86rem] font-semibold', status === key ? 'border-[#14231E] bg-[#14231E] text-white' : 'border-[#D8E1DD] bg-white text-[#5A6B65]')}>
              {STATUS_LABEL[key].label}
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-x-auto rounded-[14px] border border-[#D8E1DD] bg-white">
        {isLoading ? <p className="p-5 text-sm text-muted-foreground">Chargement…</p> : real.length === 0 ? <p className="p-6 text-center text-[#5A6B65]">Aucun cabinet ne correspond.</p> : (
          <table className="w-full min-w-[720px] text-[0.9rem]">
            <thead>
              <tr className="text-[0.72rem] uppercase tracking-[0.07em] text-[#5A6B65]">
                <th className="px-4 py-3 text-start font-bold">Cabinet</th><th className="px-4 py-3 text-start font-bold">Plan</th><th className="px-4 py-3 text-start font-bold">Statut</th>
                <th className="px-4 py-3 text-start font-bold">Échéance</th><th className="px-4 py-3 text-start font-bold">Équipe · Patients</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {real.map(c => {
                const st = STATUS_LABEL[statusOf(c)]
                return (
                  <tr key={c.id} className="border-t border-[#D8E1DD] align-middle">
                    <td className="px-4 py-3"><b className="block font-semibold">{c.name}</b><span className="text-[0.82rem] text-[#5A6B65]">{[c.city, t(`specialty.${c.specialty}`)].filter(Boolean).join(' · ')}</span>
                      {c.supportAccess && <span className="mt-1 flex items-center gap-1 text-[0.78rem] font-semibold text-[#99600B]"><ShieldCheck size={13} />Support autorisé jusqu’au {formatDateTimeFR(c.supportAccess.expiresAt)}</span>}
                    </td>
                    <td className="px-4 py-3">{c.plan}</td>
                    <td className="px-4 py-3"><span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.78rem] font-bold', st.pill)}><i className="h-[7px] w-[7px] rounded-full bg-current" />{st.label}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[0.85rem]">{c.currentPeriodEnd ? formatDateFR(c.currentPeriodEnd) : '—'}</td>
                    <td className="px-4 py-3 tabular-nums">{c._count?.users ?? 0} · {c._count?.patients ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setManaged(c)}><CalendarClock size={15} className="me-1" />Abonnement</Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Autres actions pour ${c.name}`}><MoreHorizontal size={17} /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuItem disabled={!canOpen(c)} onClick={() => open(c)}><Eye size={15} className="me-2" />{canOpen(c) ? 'Ouvrir (accès support)' : 'Accès support non autorisé'}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/users?cabinetId=${c.id}`)}><Users size={15} className="me-2" />Comptes</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/messages?cabinet=${c.id}`)}><MessageSquareText size={15} className="me-2" />Envoyer un message</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggle.mutate(c)}>{c.isActive === false ? 'Réactiver' : 'Suspendre'}</DropdownMenuItem>
                            <DropdownMenuItem className="text-[#B8372C] focus:text-[#B8372C]" onClick={() => { if (window.confirm(`Supprimer « ${c.name} » ? Les données sont conservées mais le cabinet n’est plus accessible.`)) remove.mutate(c.id) }}><Trash2 size={15} className="me-2" />Supprimer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Nouveau cabinet</DialogTitle><DialogDescription>Le catalogue d’actes par défaut de la spécialité est copié dans le cabinet.</DialogDescription></DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); create.mutate() }}>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="c-name">Nom du cabinet</Label><Input id="c-name" value={form.name} onChange={set('name')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="c-spec">Spécialité</Label><NativeSelect id="c-spec" value={form.specialty} onChange={set('specialty')}>{SPECIALTIES.map(s => <option key={s} value={s}>{t(`specialty.${s}`)}</option>)}</NativeSelect></div>
            <div className="space-y-1.5"><Label htmlFor="c-plan">Plan</Label><NativeSelect id="c-plan" value={form.plan} onChange={set('plan')} required><option value="">—</option>{plans.filter(p => p.isActive).map(p => <option key={p.code} value={p.code}>{p.name}</option>)}</NativeSelect></div>
            <div className="space-y-1.5"><Label htmlFor="c-city">Ville</Label><Input id="c-city" value={form.city} onChange={set('city')} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-phone">Téléphone</Label><Input id="c-phone" value={form.phone} onChange={set('phone')} /></div>
            <p className="pt-2 text-sm font-semibold sm:col-span-2">Médecin titulaire (optionnel)</p>
            <div className="space-y-1.5"><Label htmlFor="o-last">Nom</Label><Input id="o-last" value={form.ownerLastName} onChange={set('ownerLastName')} required={!!form.ownerEmail} /></div>
            <div className="space-y-1.5"><Label htmlFor="o-first">Prénom</Label><Input id="o-first" value={form.ownerFirstName} onChange={set('ownerFirstName')} required={!!form.ownerEmail} /></div>
            <div className="space-y-1.5"><Label htmlFor="o-email">Email</Label><Input id="o-email" type="email" value={form.ownerEmail} onChange={set('ownerEmail')} /></div>
            <div className="space-y-1.5"><Label htmlFor="o-phone">Téléphone</Label><Input id="o-phone" value={form.ownerPhone} onChange={set('ownerPhone')} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="o-pass">Mot de passe provisoire</Label><Input id="o-pass" type="password" minLength={8} value={form.ownerPassword} onChange={set('ownerPassword')} required={!!form.ownerEmail} autoComplete="new-password" /></div>
            <Button type="submit" className="sm:col-span-2" disabled={create.isPending}>Créer le cabinet</Button>
          </form>
        </DialogContent>
      </Dialog>

      <SubscriptionDialog cabinet={managed} onOpenChange={(o) => !o && setManaged(null)} />
    </div>
  )
}
