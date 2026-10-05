import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertCircle, CalendarDays, ClipboardList, UserPlus, UserRoundCheck, Wallet } from 'lucide-react'
import api from '../lib/api'
import { useAuth, useCabinetApi, useCabinetPath } from '../lib/hooks'
import { formatCurrency } from '../lib/utils'
import { CabinetDashboard } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import SpecialtyStats from '../components/layout/SpecialtyStats'
import { useL } from '../lib/labels'

function Stat({ icon, label, value, hint, to }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; to?: string }) {
  const body = (
    <div className="flex h-full items-start gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4 transition-colors hover:border-primary/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export default function Dashboard() {
  const L = useL()
  const { t } = useTranslation()
  const { user, hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const currency = user?.cabinet?.currency || 'MAD'
  const { data } = useQuery({
    queryKey: ['dashboard', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/dashboard`)).data.data as CabinetDashboard,
    refetchInterval: 60_000,
  })
  const dental = user?.specialty === 'DENTISTRY' || user?.cabinet?.specialty === 'DENTISTRY'

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={user?.cabinet?.name} title={`${L('Bonjour')} ${user?.title ? `${user.title} ` : ''}${user?.lastName || ''}`} subtitle={user?.role === 'PRACTITIONER' ? L('Vos chiffres personnels') : L('Activité du cabinet')} />
      {!data ? <p className="text-sm text-muted-foreground">{L('Chargement…')}</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<CalendarDays size={19} />} label={L('Rendez-vous du jour')} value={data.todayAppointments} hint={`${data.seenToday} ${L('patient(s) vu(s)')}`} to={cabinetPath('/waiting-room')} />
            <Stat icon={<Wallet size={19} />} label={L('Encaissé aujourd’hui')} value={formatCurrency(data.revenueToday, currency)} hint={`${L('Ce mois :')} ${formatCurrency(data.revenueMonth, currency)}`} to={hasPermissions('MANAGE_BILLING') ? cabinetPath('/billing') : undefined} />
            <Stat icon={<AlertCircle size={19} />} label={L('Impayés')} value={formatCurrency(data.unpaid.amount, currency)} hint={`${data.unpaid.invoices} ${L('facture(s)')}`} to={hasPermissions('MANAGE_BILLING') ? cabinetPath('/billing?status=OPEN') : undefined} />
            <Stat icon={<UserRoundCheck size={19} />} label={L('Taux d’absence (30 j)')} value={`${Math.round(data.noShowRate * 100)} %`} />
            <Stat icon={<UserPlus size={19} />} label={L('Nouveaux patients')} value={data.newPatients} hint={L('ce mois')} to={cabinetPath('/patients')} />
            {dental && hasPermissions('DENTAL_TREATMENT_PLAN') && <Stat icon={<ClipboardList size={19} />} label={L('Plans de traitement en cours')} value={data.dental.plansInProgress} hint={`${data.dental.quotesOpen} devis en attente`} />}
          </div>

          <SpecialtyStats />

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-[14px] border border-[#D8E1DD] bg-white p-4">
              <h3 className="mb-3 font-bold">{L('Actes les plus fréquents (30 jours)')}</h3>
              {data.topActs.length === 0 ? <p className="text-sm text-muted-foreground">{L('Aucun acte facturé.')}</p> : (
                <ul className="space-y-2 text-sm">
                  {data.topActs.map(a => (
                    <li key={a.label} className="flex items-center justify-between gap-3">
                      <span className="truncate">{a.label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{a.count} · <b className="text-foreground">{formatCurrency(a.total, currency)}</b></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-[14px] border border-[#D8E1DD] bg-white p-4">
              <h3 className="mb-3 font-bold">{L('Encaissements sur 6 mois')}</h3>
              {data.revenueByMonth ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.revenueByMonth.map(m => ({ ...m, label: m.month.slice(5) + '/' + m.month.slice(2, 4) }))}>
                      <CartesianGrid vertical={false} stroke="#E3EAE7" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} width={60} />
                      <Tooltip formatter={(v: number) => formatCurrency(v, currency)} cursor={{ fill: '#E9EFEC' }} />
                      <Bar dataKey="total" name={L('Encaissé')} fill="#12705A" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground">{L('Statistiques avancées disponibles dans les plans Pro et Clinique.')}</p>}
            </section>
          </div>
        </>
      )}
      <p className="sr-only">{t('nav.dashboard')}</p>
    </div>
  )
}
