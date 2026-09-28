import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlarmClock, BadgeCheck, CalendarX2, Gift, MessageCircle, MessageSquareText, Repeat, TrendingUp, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { formatCurrency, formatDateFR } from '../../lib/utils'
import { SaasMetrics, SaasCabinetRef } from '../../types'
import { StatCard } from './StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { SubscriptionDialog, SubscriptionTarget } from '../SubscriptionDialog'
import { whatsappLink } from '../../pages/SubscriptionBlocked'

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function SaasSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [managed, setManaged] = useState<SubscriptionTarget | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['saas-metrics'],
    queryFn: async () => (await api.get('/cabinets/saas-metrics')).data.data as SaasMetrics,
  })

  const relative = (date: string | null) => {
    if (!date) return '—'
    const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000)
    if (days === 0) return t('saas.today')
    return days > 0 ? t('saas.inDays', { count: days }) : t('saas.ago', { count: -days })
  }

  const list = (title: string, icon: JSX.Element, chip: string, cabinets: SaasCabinetRef[]) => (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span className={`icon-chip h-9 w-9 rounded-xl ${chip}`}>{icon}</span>
          {title}
        </CardTitle>
        <span className="rounded-full bg-[#E9EFEC] px-2.5 py-1 text-xs font-bold text-[#12705A]">{cabinets.length}</span>
      </CardHeader>
      <CardContent className="space-y-2">
        {!cabinets.length ? (
          <p className="rounded-2xl bg-[#F2F5F3] py-5 text-center text-sm text-[#5A6B65]">{t('saas.none')}</p>
        ) : cabinets.slice(0, 6).map(cabinet => (
          <div key={cabinet.id} className="rounded-2xl border border-[#E3EAE7] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#14231E]">{cabinet.name}</p>
                <p className="text-xs text-[#5A6B65]">{cabinet.plan} · {cabinet.currentPeriodEnd ? formatDateFR(cabinet.currentPeriodEnd) : '—'}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#FFF3D4] px-2 py-0.5 text-xs font-semibold text-[#8A5A00]">{relative(cabinet.currentPeriodEnd)}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" className="h-8" onClick={() => setManaged(cabinet)}>{t('saas.manage')}</Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => navigate(`/messages?cabinet=${cabinet.id}`)}><MessageSquareText size={13} /> {t('saas.message')}</Button>
              {cabinet.phone && (
                <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-[#1DA851] hover:text-[#1DA851]">
                  <a href={whatsappLink(cabinet.phone)} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a>
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
      </div>
    )
  }

  const chartData = data.revenueByMonth.map(point => ({ ...point, label: MONTHS[Number(point.month.slice(5, 7)) - 1] }))

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-7 w-1.5 rounded-full bg-primary" />
        <h2 className="text-xl font-bold tracking-[-0.03em] text-[#14231E]">{t('saas.title')}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={<Repeat size={20} />} label={t('saas.mrr')} value={data.mrr} currency tone="blue" highlight />
        <StatCard icon={<Wallet size={20} />} label={t('saas.collected')} value={data.collectedThisMonth} currency tone="green" />
        <StatCard icon={<BadgeCheck size={20} />} label={t('saas.paying')} value={data.counts.paying} tone="violet" subtitle={t('saas.newThisMonth', { count: data.counts.newThisMonth })} />
        <StatCard icon={<Gift size={20} />} label={t('saas.trialing')} value={data.counts.trialing} tone="amber" subtitle={`${t('saas.expired')} ${data.counts.expired} · ${t('saas.suspended')} ${data.counts.suspended}`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="icon-chip h-9 w-9 rounded-xl bg-[#E1FAEC] text-[#087A4B]"><TrendingUp size={17} /></span>
              {t('saas.revenue6m')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-60 px-2 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8E1DD" vertical={false} />
                <XAxis dataKey="label" stroke="#8A9A94" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#8A9A94" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                <Tooltip cursor={{ fill: 'rgba(40, 199, 123, 0.08)' }} contentStyle={{ borderRadius: 12, border: '1px solid #D8E1DD' }} formatter={(v: number) => [formatCurrency(v), t('invoices.paidTotal')]} />
                <Bar dataKey="total" fill="#28C77B" radius={[8, 8, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t('saas.byPlan')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-[#E9EFEC] p-3">
              <p className="text-xs font-semibold text-[#5A6B65]">{t('saas.conversion')}</p>
              <p className="mt-1 text-2xl font-bold text-[#14231E]">{Math.round(data.trialConversion.rate * 100)}%</p>
              <p className="text-xs text-[#5A6B65]">{t('saas.conversionDetail', { converted: data.trialConversion.converted, trials: data.trialConversion.trials })}</p>
            </div>
            {!data.byPlan.length ? (
              <p className="text-sm text-[#5A6B65]">{t('saas.none')}</p>
            ) : data.byPlan.map(row => {
              const share = data.mrr ? (row.mrr / data.mrr) * 100 : 0
              return (
                <div key={row.plan}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-[#14231E]">{row.name} <span className="font-normal text-[#5A6B65]">· {t('saas.cabinets', { count: row.cabinets })}</span></span>
                    <span className="font-bold text-primary">{formatCurrency(row.mrr)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#DCEEE7]"><div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} /></div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {list(t('saas.trialsEnding'), <Gift size={17} />, 'bg-[#FFF3D4] text-[#B87700]', data.trialsEndingSoon)}
        {list(t('saas.renewals'), <AlarmClock size={17} />, 'bg-[#DCEEE7] text-[#12705A]', data.renewalsDueSoon)}
        {list(t('saas.recentlyExpired'), <CalendarX2 size={17} />, 'bg-[#FFE8EB] text-[#C52B45]', data.recentlyExpired)}
      </div>

      <SubscriptionDialog cabinet={managed} onOpenChange={open => { if (!open) setManaged(null) }} />
    </section>
  )
}
