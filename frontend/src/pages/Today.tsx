import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ar, enGB, fr } from 'date-fns/locale'
import { Plus, UserPlus } from 'lucide-react'
import api from '../lib/api'
import { practitionerName, useAuth, useCabinetApi, useCabinetPath, useTeam } from '../lib/hooks'
import { cn, formatCurrency } from '../lib/utils'
import { Appointment, AppointmentStatus, CabinetDashboard, Invoice, Role } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import SetupGuide from '../components/layout/SetupGuide'
import { Button } from '../components/ui/button'
import AppointmentDialog from '../components/agenda/AppointmentDialog'
import WalkInDialog from '../components/agenda/WalkInDialog'
import { useAppointmentStatus } from '../components/agenda/AppointmentActions'
import ChargeForm from '../components/billing/ChargeForm'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { useL } from '../lib/labels'

export const STATUS_PILL: Record<AppointmentStatus, string> = {
  PLANNED: 'bg-[#E9EFEC] text-[#5A6B65]',
  CONFIRMED: 'bg-[#E9EFEC] text-[#14231E]',
  ARRIVED: 'bg-[#FBEED6] text-[#99600B]',
  IN_CONSULTATION: 'bg-[#E1E9F7] text-[#2D5DAA]',
  DONE: 'bg-[#DFF1E6] text-[#1E7A45]',
  CANCELLED: 'bg-[#E9EFEC] text-[#5A6B65] line-through',
  NO_SHOW: 'bg-[#FBE3E0] text-[#B8372C]',
}

export function StatusPill({ status }: { status: AppointmentStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.78rem] font-bold', STATUS_PILL[status])}>
      <i aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-current" />{t(`appointmentStatus.${status}`)}
    </span>
  )
}

const ageOf = (birthDate: string | null | undefined) => {
  if (!birthDate) return null
  const b = new Date(birthDate), now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}
/** 35 min, or 4 h 05 once it passes an hour. */
const duration = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`)
const patientLabel = (a: Appointment) => (a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—')

/** Home of every cabinet user: the day at a glance, with one obvious next action. */
export default function Today() {
  const L = useL()
  const { t, i18n } = useTranslation()
  const { user, hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const navigate = useNavigate()
  const setStatus = useAppointmentStatus()
  const { data: team = [] } = useTeam()
  const [booking, setBooking] = useState(false)
  const [walkIn, setWalkIn] = useState(false)
  // "Encaisser" opens the payment right here, prefilled with what the patient owes.
  const [paying, setPaying] = useState<{ appointment: Appointment; mode: 'collect' | 'visit' } | null>(null)
  const [filter, setFilter] = useState<string>(user?.role === Role.OWNER ? 'me' : 'all')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['waiting-room', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/appointments/waiting-room`)).data.data as Appointment[],
    refetchInterval: 15_000,
  })
  const showStats = user?.role === Role.OWNER && hasPermissions('VIEW_REPORTS')
  const { data: stats } = useQuery({
    queryKey: ['dashboard', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/dashboard`)).data.data as CabinetDashboard,
    enabled: showStats,
    refetchInterval: 60_000,
  })

  const doctorView = user?.role === Role.OWNER || user?.role === Role.PRACTITIONER
  const canTreat = hasPermissions('MANAGE_CONSULTATIONS')
  const canBill = hasPermissions('MANAGE_BILLING')
  // Patients who still owe something: only they get an "Encaisser" button.
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', cabinetApi, 'unpaid'],
    queryFn: async () => (await api.get(`${cabinetApi}/billing/invoices`)).data.data as Invoice[],
    enabled: canBill,
  })
  const owing = new Set(invoices.filter(inv => inv.status === 'OPEN' || inv.status === 'PARTIAL').map(inv => inv.patient.id))
  // Seen today but not billed yet: "Encaisser" then proposes the consultation act.
  const todayKey = new Date().toISOString().slice(0, 10)
  const billedToday = new Set(invoices.filter(inv => inv.status !== 'CANCELLED' && inv.date.slice(0, 10) === todayKey).map(inv => inv.patient.id))
  const currency = user?.cabinet?.currency || 'MAD'
  const locale = i18n.language.startsWith('ar') ? ar : i18n.language.startsWith('en') ? enGB : fr
  const dayLabel = format(new Date(), 'EEEE d MMMM', { locale }).replace(/^./, c => c.toUpperCase())
  const practitioners = team.filter(m => m.role === 'OWNER' || m.role === 'PRACTITIONER')

  const byTime = [...items].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
  const mine = byTime.filter(a => a.practitionerId === user?.id)
  const list = filter === 'all' ? byTime : filter === 'me' ? mine : byTime.filter(a => a.practitionerId === filter)
  const room = byTime.filter(a => a.status === 'ARRIVED' || a.status === 'IN_CONSULTATION')
  const toCome = byTime.filter(a => a.status === 'PLANNED' || a.status === 'CONFIRMED').length

  const openFile = (a: Appointment, tab?: string) => a.patientId && navigate(cabinetPath(`/patients/${a.patientId}${tab ? `?tab=${tab}` : ''}`))
  const startVisit = (a: Appointment) => setStatus.mutate({ id: a.id, status: 'IN_CONSULTATION' }, {
    onSuccess: () => { if (canTreat && a.patientId && (a.practitionerId === user?.id || user?.role === Role.OWNER)) navigate(cabinetPath(`/patients/${a.patientId}?consult=${a.id}`)) },
  })

  // One action per row, the one that moves the patient forward.
  const action = (a: Appointment) => {
    const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }
    if (a.status === 'PLANNED' || a.status === 'CONFIRMED') return <Button size="sm" onClick={stop(() => setStatus.mutate({ id: a.id, status: 'ARRIVED' }))}>{t('today.checkIn')}</Button>
    if (a.status === 'ARRIVED') return <Button size="sm" variant="outline" onClick={stop(() => startVisit(a))}>{t('today.sendIn')}</Button>
    if (a.status === 'IN_CONSULTATION' && doctorView && (a.practitionerId === user?.id || user?.role === Role.OWNER)) return <Button size="sm" variant="outline" onClick={stop(() => setStatus.mutate({ id: a.id, status: 'DONE' }))}>{t('today.finish')}</Button>
    if (a.status === 'DONE' && canBill && a.patientId && (owing.has(a.patientId) || !billedToday.has(a.patientId))) return <Button size="sm" variant="outline" onClick={stop(() => setPaying({ appointment: a, mode: owing.has(a.patientId!) ? 'collect' : 'visit' }))}>{L('Encaisser')}</Button>
    return null
  }

  const row = (a: Appointment, showDoctor: boolean) => (
    <div
      key={a.id}
      role="button"
      tabIndex={0}
      onClick={() => openFile(a)}
      onKeyDown={(e) => { if (e.key === 'Enter') openFile(a) }}
      className={cn(
        'grid cursor-pointer grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-t border-[#D8E1DD] px-4 py-3 first:border-t-0 hover:bg-[#E9EFEC] sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:px-[18px]',
        (a.status === 'DONE' || a.status === 'NO_SHOW') && 'opacity-60',
      )}
    >
      <span className="font-mono text-[0.92rem] font-semibold tabular-nums">{format(new Date(a.walkIn && a.arrivedAt ? a.arrivedAt : a.date), 'HH:mm')}</span>
      <div className="min-w-0">
        <b className="block truncate font-semibold">{patientLabel(a)}</b>
        <span className="block truncate text-[0.86rem] text-[#5A6B65]">
          {[a.walkIn ? t('appointment.walkIn') : null, a.reason, showDoctor ? practitionerName(a.practitioner) : null, a.waitingMinutes ? t('today.waited', { time: duration(a.waitingMinutes) }) : null].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-2.5 sm:col-span-1 sm:justify-end">
        <StatusPill status={a.status} />{action(a)}
      </div>
    </div>
  )

  const section = (title: string, rows: Appointment[], showDoctor: boolean, empty: string, head?: React.ReactNode) => (
    <section className="rounded-[14px] border border-[#D8E1DD] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-[18px] pb-2.5 pt-4"><h2 className="text-[1.08rem] font-bold">{title}</h2>{head}</div>
      {isLoading ? <p className="px-[18px] pb-5 text-sm text-[#5A6B65]">{L('Chargement…')}</p>
        : rows.length === 0 ? <p className="px-[18px] pb-6 pt-2 text-center text-[#5A6B65]">{empty}</p>
        : <div>{rows.map(a => row(a, showDoctor))}</div>}
    </section>
  )

  const chips = (options: [string, string][]) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([key, label]) => (
        <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key}
          className={cn('rounded-full border px-3 py-1.5 text-[0.86rem] font-semibold', filter === key ? 'border-[#14231E] bg-[#14231E] text-white' : 'border-[#D8E1DD] bg-white text-[#5A6B65]')}>
          {label}
        </button>
      ))}
    </div>
  )

  const addButtons = (
    <>
      <Button variant="outline" onClick={() => setWalkIn(true)}><UserPlus size={17} className="me-1.5" />{t('today.walkIn')}</Button>
      <Button onClick={() => setBooking(true)}><Plus size={17} className="me-1.5" />{t('today.newAppointment')}</Button>
    </>
  )

  const dialogs = (
    <>
      <AppointmentDialog open={booking} onOpenChange={setBooking} />
      <WalkInDialog open={walkIn} onOpenChange={setWalkIn} />
      <Dialog open={paying !== null} onOpenChange={(open) => !open && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{L('Encaisser')}</DialogTitle>
            <DialogDescription>{paying ? patientLabel(paying.appointment) : ''}</DialogDescription>
          </DialogHeader>
          {paying?.appointment.patientId && <ChargeForm patientId={paying.appointment.patientId} mode={paying.mode} onDone={() => setPaying(null)} />}
        </DialogContent>
      </Dialog>
    </>
  )

  if (!doctorView) {
    // Reception: the whole schedule on one side, who is in the building on the other.
    return (
      <div className="grid gap-5">
        <PageHeader title={t('nav.today')} subtitle={<span>{dayLabel} · {t('today.inRoom', { count: room.length })} · {t('today.toCome', { count: toCome })}</span>} actions={addButtons} />
        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {section(t('today.schedule'), list, true, t('today.noAppointments'),
            practitioners.length > 1 ? chips([['all', t('today.allDoctors')], ...practitioners.map(p => [p.id, practitionerName(p)] as [string, string])]) : undefined)}
          {section(t('today.waitingRoom'), room, true, t('today.nobodyWaiting'))}
        </div>
        {dialogs}
      </div>
    )
  }

  // Doctor: the next patient first, then the rest of the day.
  const current = mine.find(a => a.status === 'IN_CONSULTATION') || mine.find(a => a.status === 'ARRIVED') || mine.find(a => a.status === 'PLANNED' || a.status === 'CONFIRMED')
  const age = current ? ageOf(current.patient?.birthDate) : null
  const label = !current ? '' : current.status === 'IN_CONSULTATION' ? t('today.withYou')
    : current.status === 'ARRIVED' ? t('today.waitingFor', { time: duration(current.waitingMinutes || 0) }) : t('today.nextAt', { time: format(new Date(current.date), 'HH:mm') })

  return (
    <div className="grid gap-5">
      <PageHeader
        title={t('today.hello', { name: `${user?.title ? `${user.title} ` : ''}${user?.lastName || ''}` })}
        subtitle={<span>{dayLabel} · {t('today.onList', { count: mine.length })}</span>}
        actions={user?.role === Role.OWNER ? addButtons : undefined}
      />
      <SetupGuide />

      {current ? (
        <section className="grid gap-3.5 rounded-[18px] bg-primary px-6 py-[22px] text-white">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] opacity-80">{label}</span>
          <div>
            <h2 className="text-[1.6rem] font-extrabold leading-tight">{patientLabel(current)}</h2>
            <p className="opacity-90">{[age !== null ? t('today.years', { count: age }) : null, current.reason].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {current.status === 'IN_CONSULTATION' ? (
              <>
                <Button size="lg" className="bg-white text-primary hover:bg-[#DCEEE7]" onClick={() => openFile(current)}>{t('today.openFile')}</Button>
                <Button size="lg" variant="outline" className="border-white bg-transparent text-white hover:border-white hover:bg-white/10" onClick={() => setStatus.mutate({ id: current.id, status: 'DONE' })}>{t('today.finish')}</Button>
              </>
            ) : current.status === 'ARRIVED' ? (
              <Button size="lg" className="bg-white text-primary hover:bg-[#DCEEE7]" onClick={() => startVisit(current)}>{t('today.start')}</Button>
            ) : (
              <Button size="lg" variant="outline" className="border-white bg-transparent text-white hover:border-white hover:bg-white/10" onClick={() => openFile(current)}>{t('today.lookFile')}</Button>
            )}
          </div>
        </section>
      ) : !isLoading && (
        <section className="grid gap-1 rounded-[18px] border border-dashed border-[#D8E1DD] bg-white px-6 py-[22px]">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{t('today.allDone')}</span>
          <h2 className="text-[1.3rem] font-extrabold">{t('today.noMore')}</h2>
        </section>
      )}

      {showStats && stats && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {[
            [t('today.seen'), `${stats.seenToday} / ${stats.todayAppointments}`, false],
            [t('today.collected'), formatCurrency(stats.revenueToday, currency), false],
            [t('today.unpaid'), formatCurrency(stats.unpaid.amount, currency), stats.unpaid.amount > 0],
          ].map(([name, value, warn]) => (
            <div key={name as string} className="grid gap-0.5 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3.5">
              <span className="text-[0.86rem] text-[#5A6B65]">{name}</span>
              <b className={cn('text-[1.5rem] font-extrabold tabular-nums tracking-[-0.02em]', warn && 'text-[#B8372C]')}>{value}</b>
            </div>
          ))}
        </div>
      )}

      {user?.role === Role.OWNER && practitioners.length > 1
        ? section(t('today.schedule'), list, filter !== 'me', t('today.noAppointments'), chips([['me', 'Moi'], ['all', t('today.allDoctors')]]))
        : section(t('today.mySchedule'), mine, false, t('today.noAppointments'))}
      {dialogs}
    </div>
  )
}
