import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, CalendarClock, Eye, MessageSquareText, Power, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { apiError } from '../lib/hooks'
import { cn, formatDateFR } from '../lib/utils'
import { Cabinet, Specialty } from '../types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { NativeSelect } from '../components/ui/native-select'
import { SubscriptionDialog } from '../components/SubscriptionDialog'
import Users from './Users'
import { useL } from '../lib/labels'

const SPECIALTIES: Specialty[] = ['DENTISTRY', 'GENERAL', 'PEDIATRICS', 'GYNECOLOGY', 'OPHTHALMOLOGY', 'CARDIOLOGY', 'DERMATOLOGY', 'PHYSIOTHERAPY', 'PSYCHIATRY']
type Tab = 'team' | 'infos' | 'subscription'
type History = { id: string; plan: string; status: string; startedAt: string; periodEnd: string | null; createdAt: string }
const STATUS: Record<string, [string, string]> = {
  ACTIVE: ['Actif', 'bg-[#DFF1E6] text-[#1E7A45]'],
  TRIALING: ['Essai gratuit', 'bg-[#E1E9F7] text-[#2D5DAA]'],
  PAST_DUE: ['Expiré', 'bg-[#FBE3E0] text-[#B8372C]'],
  SUSPENDED: ['Suspendu', 'bg-[#FBE3E0] text-[#B8372C]'],
  CANCELLED: ['Résilié', 'bg-[#FBE3E0] text-[#B8372C]'],
}
const Pill = ({ status }: { status: string }) => {
  const L = useL()
  const [label, tone] = STATUS[status] || [status, 'bg-[#E9EFEC] text-[#5A6B65]']
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.78rem] font-bold', tone)}><i className="h-[7px] w-[7px] rounded-full bg-current" />{L(label)}</span>
}

/** One cabinet for the Super Admin: its team, its details and its subscription, in one place. */
export default function CabinetDetail() {
  const L = useL()
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'team'
  const [managing, setManaging] = useState(false)
  const [form, setForm] = useState({ name: '', specialty: 'DENTISTRY' as Specialty, city: '', address: '', phone: '', email: '' })

  const { data: cabinet, isLoading } = useQuery({
    queryKey: ['cabinet', id],
    queryFn: async () => (await api.get(`/cabinets/${id}`)).data.data as Cabinet,
  })
  const { data: history = [] } = useQuery({
    queryKey: ['subscription-history', id],
    queryFn: async () => (await api.get(`/cabinets/${id}/subscription-history`)).data.data as History[],
    enabled: tab === 'subscription',
  })
  const { data: grants } = useQuery({
    queryKey: ['all-cabinets'],
    queryFn: async () => (await api.get('/cabinets')).data.data as Cabinet[],
    select: (list) => list.find(c => c.id === id)?.supportAccess || null,
  })

  useEffect(() => {
    if (cabinet) setForm({ name: cabinet.name, specialty: cabinet.specialty, city: cabinet.city || '', address: cabinet.address || '', phone: cabinet.phone || '', email: cabinet.email || '' })
  }, [cabinet])

  const refresh = () => ['cabinet', 'all-cabinets', 'saas-metrics'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
  const save = useMutation({
    mutationFn: () => api.patch(`/cabinets/${id}`, { ...form, city: form.city || null, address: form.address || null, phone: form.phone || null, email: form.email || null }),
    onSuccess: () => { toast.success(L('Informations enregistrées')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const toggle = useMutation({
    mutationFn: async () => {
      if (cabinet!.isActive === false) await api.patch(`/cabinets/${id}/subscription`, { plan: cabinet!.plan, subscriptionStatus: 'ACTIVE' })
      else await api.patch(`/cabinets/${id}/status`, { isActive: false })
    },
    onSuccess: () => { toast.success(cabinet?.isActive === false ? L('Cabinet réactivé') : L('Cabinet suspendu : ses comptes voient la page de renouvellement')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const remove = useMutation({
    mutationFn: () => api.delete(`/cabinets/${id}`),
    onSuccess: () => { toast.success(L('Cabinet supprimé')); refresh(); navigate('/cabinets') },
    onError: (err) => toast.error(apiError(err)),
  })

  if (isLoading) return <p className="py-10 text-center text-[#5A6B65]">{L('Chargement…')}</p>
  if (!cabinet) return <p className="py-10 text-center text-[#5A6B65]">{L('Cabinet introuvable.')}</p>

  const status = cabinet.isActive === false && cabinet.subscriptionStatus !== 'PAST_DUE' ? 'SUSPENDED' : cabinet.subscriptionStatus || 'ACTIVE'
  const end = cabinet.subscriptionStatus === 'TRIALING' ? cabinet.trialEndsAt || cabinet.currentPeriodEnd : cabinet.currentPeriodEnd
  const canOpen = cabinet.isDemo || !!grants
  const setTab = (next: Tab) => setParams({ tab: next }, { replace: true })
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="grid gap-5">
      <div>
        <Link to="/cabinets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"><ArrowLeft size={15} className="rtl:rotate-180" />{L('Tous les cabinets')}</Link>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.6rem] font-extrabold leading-tight">{cabinet.name}</h1>
            {cabinet.isDemo ? <span className="rounded-full bg-[#EEE7F8] px-2.5 py-0.5 text-[0.78rem] font-bold text-[#6746A8]">{L('Démo')}</span> : <Pill status={status} />}
          </div>
          <p className="text-[#5A6B65]">
            {[t(`specialty.${cabinet.specialty}`), cabinet.city, `${L('Plan')} ${cabinet.plan}`, !cabinet.isDemo && (end ? `${L('jusqu’au')} ${formatDateFR(end)}` : L('sans échéance')), `${cabinet._count?.patients ?? 0} patient(s)`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOpen && <Button variant="outline" onClick={() => navigate(`/today?cabinetId=${cabinet.id}`)}><Eye size={16} className="me-1.5" />{cabinet.isDemo ? L('Ouvrir la démo') : L('Ouvrir (support)')}</Button>}
          {!cabinet.isDemo && <Button variant="outline" onClick={() => navigate(`/messages?cabinet=${cabinet.id}`)}><MessageSquareText size={16} className="me-1.5" />{L('Message')}</Button>}
          {!cabinet.isDemo && <Button onClick={() => setManaging(true)}><CalendarClock size={16} className="me-1.5" />{L('Abonnement')}</Button>}
        </div>
      </header>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-[#D8E1DD]">
        {([['team', L('Équipe')], ['infos', L('Informations')], ['subscription', L('Abonnement')]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('-mb-px shrink-0 whitespace-nowrap border-b-[2.5px] px-3.5 py-2.5 font-semibold', tab === key ? 'border-primary text-[#14231E]' : 'border-transparent text-[#5A6B65] hover:text-[#14231E]')}>{label}</button>
        ))}
      </div>

      {tab === 'team' && <Users cabinetId={cabinet.id} embedded />}

      {tab === 'infos' && (
        <form className="grid gap-4 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px] sm:grid-cols-2" onSubmit={e => { e.preventDefault(); save.mutate() }}>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="c-name">{L('Nom du cabinet')}</Label><Input id="c-name" value={form.name} onChange={set('name')} required /></div>
          <div className="space-y-1.5"><Label htmlFor="c-spec">{L('Spécialité principale')}</Label>
            <NativeSelect id="c-spec" value={form.specialty} onChange={set('specialty')}>{SPECIALTIES.map(s => <option key={s} value={s}>{t(`specialty.${s}`)}</option>)}</NativeSelect>
          </div>
          <div className="space-y-1.5"><Label htmlFor="c-city">{L('Ville')}</Label><Input id="c-city" value={form.city} onChange={set('city')} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="c-address">{L('Adresse')}</Label><Input id="c-address" value={form.address} onChange={set('address')} /></div>
          <div className="space-y-1.5"><Label htmlFor="c-phone">{L('Téléphone')}</Label><Input id="c-phone" value={form.phone} onChange={set('phone')} /></div>
          <div className="space-y-1.5"><Label htmlFor="c-email">{L('Email')}</Label><Input id="c-email" type="email" value={form.email} onChange={set('email')} /></div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D8E1DD] pt-4 sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>{L('Enregistrer')}</Button>
            {!cabinet.isDemo && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => toggle.mutate()} disabled={toggle.isPending}><Power size={16} className="me-1.5" />{cabinet.isActive === false ? L('Réactiver le cabinet') : L('Suspendre le cabinet')}</Button>
                <Button type="button" variant="ghost" className="text-[#B8372C] hover:text-[#B8372C]" onClick={() => { if (window.confirm(`${L('Supprimer')} « ${cabinet.name} » ? ${L('Les données sont conservées mais le cabinet n’est plus accessible.')}`)) remove.mutate() }}><Trash2 size={16} className="me-1.5" />{L('Supprimer')}</Button>
              </div>
            )}
          </div>
        </form>
      )}

      {tab === 'subscription' && (
        <div className="grid gap-4">
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px]">
            <div>
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{L('Abonnement actuel')}</span>
              <p className="mt-1 flex flex-wrap items-center gap-2.5 text-[1.2rem] font-extrabold">Plan {cabinet.plan} {!cabinet.isDemo && <Pill status={status} />}</p>
              <p className="text-[#5A6B65]">{end ? `${L('Jusqu’au')} ${formatDateFR(end)}` : L('Sans échéance')} · {cabinet.maxPractitioners} {L('praticien(s)')} · {(cabinet.maxAssistants ?? 0) >= 999 ? L('assistants illimités') : `${cabinet.maxAssistants} assistant(s)`}</p>
            </div>
            {!cabinet.isDemo && <Button onClick={() => setManaging(true)}><CalendarClock size={16} className="me-1.5" />{L('Changer, prolonger ou encaisser')}</Button>}
          </section>
          <section className="rounded-[14px] border border-[#D8E1DD] bg-white">
            <h2 className="px-[18px] pb-2.5 pt-4 text-[1.08rem] font-bold">{L('Historique')}</h2>
            {history.length === 0 ? <p className="px-[18px] pb-6 text-[#5A6B65]">{L('Aucun changement enregistré.')}</p> : history.map(h => (
              <div key={h.id} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#D8E1DD] px-[18px] py-3 text-[0.92rem]">
                <span className="font-mono text-[0.85rem] text-[#5A6B65]">{formatDateFR(h.createdAt)}</span>
                <span>{L('Plan')} <b>{h.plan}</b>{h.periodEnd ? ` ${L('jusqu’au')} ${formatDateFR(h.periodEnd)}` : ''}</span>
                <Pill status={h.status} />
              </div>
            ))}
          </section>
        </div>
      )}

      <SubscriptionDialog cabinet={managing ? cabinet as any : null} onOpenChange={(open) => { if (!open) setManaging(false) }} />
    </div>
  )
}
