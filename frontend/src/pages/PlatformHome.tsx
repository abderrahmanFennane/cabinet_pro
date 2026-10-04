import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Building2, CalendarDays, LogIn, MessageSquare, Stethoscope, UserPlus, Wallet } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../lib/hooks'
import { cn, formatCurrency, formatDateFR } from '../lib/utils'
import { PageHeader } from '../components/layout/PageHeader'

type Brief = { id: string; name: string; city: string | null; phone: string | null; plan: string; date: string | null }
type Overview = {
  day: string
  today: { logins: number; activeUsers: number; appointments: number; consultations: number; newPatients: number; messages: number; messagesFailed: number }
  cabinets: { total: number; active: number; trialing: number; blocked: number; newThisMonth: number; byPlan: { code: string; name: string; count: number }[] }
  revenue: { monthlyRecurring: number; paidThisMonth: number; pendingInvoices: number }
  watch: { trialsEnding: Brief[]; renewalsDue: Brief[]; blocked: Brief[] }
  messaging: { providers: { sms: { provider: string }; whatsapp: { provider: string } }; failed: { id: string; channel: string; kind: string; error: string | null; createdAt: string; cabinet: string | null }[] }
}

function Tile({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; tone?: 'warn' | 'bad' }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone === 'bad' ? 'bg-[#FBE3E0] text-[#B8372C]' : tone === 'warn' ? 'bg-[#FBEED6] text-[#99600B]' : 'bg-[#DCEEE7] text-primary')}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6B65]">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-[#5A6B65]">{hint}</p>}
      </div>
    </div>
  )
}

function WatchList({ title, rows, empty, dateLabel }: { title: string; rows: Brief[]; empty: string; dateLabel: string }) {
  return (
    <section className="rounded-[14px] border border-[#D8E1DD] bg-white p-4">
      <h3 className="mb-2 font-bold">{title} <span className="text-[#5A6B65]">({rows.length})</span></h3>
      {rows.length === 0 ? <p className="text-sm text-[#5A6B65]">{empty}</p> : (
        <ul className="divide-y divide-[#E3EAE7] text-sm">
          {rows.map(r => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link to={`/cabinets/${r.id}`} className="font-semibold text-primary hover:underline">{r.name}</Link>
              <span className="text-[#5A6B65]">{[r.city, r.plan, r.date && `${dateLabel} ${formatDateFR(r.date)}`, r.phone].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Super Admin home: today on the platform, revenue, and the clinics needing attention. */
export default function PlatformHome() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['platform-overview'],
    queryFn: async () => (await api.get('/platform/overview')).data.data as Overview,
    refetchInterval: 60_000,
  })
  const providersOff = data && data.messaging.providers.sms.provider === 'log' && data.messaging.providers.whatsapp.provider === 'log'

  return (
    <div className="space-y-6">
      <PageHeader title={t('platform.hello', { name: user?.firstName || '' })} subtitle={data ? t('platform.subtitle', { date: formatDateFR(data.day) }) : ''} />
      {!data ? <p className="text-sm text-[#5A6B65]">{t('common.loading')}</p> : (
        <>
          {providersOff && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-[#FBEED6] px-4 py-3 text-sm text-[#99600B]">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>{t('platform.providersOff')} <Link to="/messages" className="font-semibold underline">{t('nav.messages')}</Link></span>
            </div>
          )}

          <h2 className="text-lg font-bold">{t('platform.today')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon={<LogIn size={19} />} label={t('platform.logins')} value={data.today.logins} hint={t('platform.activeUsers', { count: data.today.activeUsers })} />
            <Tile icon={<CalendarDays size={19} />} label={t('platform.appointments')} value={data.today.appointments} />
            <Tile icon={<Stethoscope size={19} />} label={t('platform.consultations')} value={data.today.consultations} hint={t('platform.newPatients', { count: data.today.newPatients })} />
            <Tile icon={<MessageSquare size={19} />} label={t('platform.messages')} value={data.today.messages} hint={data.today.messagesFailed ? t('platform.failed', { count: data.today.messagesFailed }) : undefined} tone={data.today.messagesFailed ? 'bad' : undefined} />
          </div>

          <h2 className="text-lg font-bold">{t('platform.business')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon={<Building2 size={19} />} label={t('platform.activeCabinets')} value={data.cabinets.active} hint={data.cabinets.byPlan.map(p => `${p.name} ${p.count}`).join(' · ')} />
            <Tile icon={<UserPlus size={19} />} label={t('platform.trials')} value={data.cabinets.trialing} hint={t('platform.newThisMonth', { count: data.cabinets.newThisMonth })} />
            <Tile icon={<Wallet size={19} />} label={t('platform.mrr')} value={formatCurrency(data.revenue.monthlyRecurring, 'MAD')} hint={t('platform.paidThisMonth', { amount: formatCurrency(data.revenue.paidThisMonth, 'MAD') })} />
            <Tile icon={<AlertTriangle size={19} />} label={t('platform.blocked')} value={data.cabinets.blocked} hint={data.revenue.pendingInvoices ? t('platform.pendingInvoices', { count: data.revenue.pendingInvoices }) : undefined} tone={data.cabinets.blocked ? 'warn' : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <WatchList title={t('platform.trialsEnding')} rows={data.watch.trialsEnding} empty={t('platform.none')} dateLabel={t('platform.ends')} />
            <WatchList title={t('platform.renewalsDue')} rows={data.watch.renewalsDue} empty={t('platform.none')} dateLabel={t('platform.ends')} />
            <WatchList title={t('platform.blockedList')} rows={data.watch.blocked} empty={t('platform.none')} dateLabel={t('platform.since')} />
          </div>

          {data.messaging.failed.length > 0 && (
            <section className="rounded-[14px] border border-[#D8E1DD] bg-white p-4">
              <h3 className="mb-2 font-bold">{t('platform.failedTitle')}</h3>
              <ul className="space-y-1.5 text-sm">
                {data.messaging.failed.map(m => (
                  <li key={m.id}><b>{m.cabinet || '—'}</b> <span className="text-[#5A6B65]">· {m.channel} · {formatDateFR(m.createdAt)} · {m.error}</span></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
