import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarOff, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import api from '../lib/api'
import { practitionerName, useAuth, useCabinetApi, useMediaQuery, useTeam } from '../lib/hooks'
import { cn } from '../lib/utils'
import { Appointment } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { NativeSelect } from '../components/ui/native-select'
import AppointmentDialog from '../components/agenda/AppointmentDialog'
import AppointmentActions, { STATUS_STYLE } from '../components/agenda/AppointmentActions'
import AbsencesDialog from '../components/agenda/AbsencesDialog'
import { Absence, APPOINTMENT_TYPES, typeColor } from '../components/agenda/appointmentTypes'
import { useL } from '../lib/labels'

type View = 'day' | 'week' | 'month'
const START_HOUR = 8
const END_HOUR = 20
const SLOT_PX = 22 // height of 15 minutes

export default function Agenda() {
  const L = useL()
  const { t } = useTranslation()
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const { data: team = [] } = useTeam()
  const isTablet = useMediaQuery('(min-width: 768px)')
  const [view, setView] = useState<View>('day')
  const [cursor, setCursor] = useState(startOfDay(new Date()))
  const [practitionerId, setPractitionerId] = useState('')
  const [creating, setCreating] = useState<{ date?: Date; practitionerId?: string } | null>(null)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [absencesOpen, setAbsencesOpen] = useState(false)

  const practitioners = team.filter(m => m.role === 'OWNER' || m.role === 'PRACTITIONER')
  const ownOnly = user?.role === 'PRACTITIONER'

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: addDays(cursor, 1) }
    if (view === 'week') { const from = startOfWeek(cursor, { weekStartsOn: 1 }); return { from, to: addDays(from, 7) } }
    return { from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), to: addDays(endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }), 1) }
  }, [view, cursor])

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', cabinetApi, range.from.toISOString(), range.to.toISOString(), practitionerId],
    queryFn: async () => (await api.get(`${cabinetApi}/appointments`, { params: { from: range.from.toISOString(), to: range.to.toISOString(), practitionerId: practitionerId || undefined } })).data.data as Appointment[],
  })

  const { data: absences = [] } = useQuery({
    queryKey: ['absences', cabinetApi, range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => (await api.get(`${cabinetApi}/appointments/absences`, { params: { from: range.from.toISOString(), to: range.to.toISOString() } })).data.data as Absence[],
  })
  // Absences touching a day: closures of the cabinet, plus those of the doctor shown (or of everyone when no doctor is chosen).
  const absencesOn = (day: Date, who?: string) => {
    const start = startOfDay(day).getTime(), end = addDays(startOfDay(day), 1).getTime()
    const mine = who || (ownOnly ? user?.id : practitionerId || undefined)
    return absences.filter(a => new Date(a.startsAt).getTime() < end && new Date(a.endsAt).getTime() > start && (!a.practitionerId || !mine || a.practitionerId === mine))
  }
  const absenceLabel = (a: Absence) => [a.practitionerId ? practitionerName(team.find(m => m.id === a.practitionerId)) : L('Cabinet fermé'), a.reason && L(a.reason)].filter(Boolean).join(' · ')

  const move = (dir: number) => setCursor(c => (view === 'day' ? addDays(c, dir) : view === 'week' ? addDays(c, 7 * dir) : addMonths(c, dir)))
  const title = view === 'day' ? format(cursor, 'EEEE d MMMM yyyy', { locale: fr }) : view === 'week' ? `${L('Semaine du')} ${format(range.from, 'd MMMM', { locale: fr })}` : format(cursor, 'MMMM yyyy', { locale: fr })

  const columns = view === 'day'
    ? (ownOnly ? practitioners.filter(p => p.id === user?.id) : practitionerId ? practitioners.filter(p => p.id === practitionerId) : practitioners).map(p => ({ key: p.id, label: practitionerName(p), day: cursor, practitionerId: p.id }))
    : Array.from({ length: 7 }, (_, i) => { const day = addDays(range.from, i); return { key: day.toISOString(), label: format(day, 'EEE d', { locale: fr }), day, practitionerId: practitionerId || undefined } })

  const block = (a: Appointment) => {
    const d = new Date(a.date)
    const top = ((d.getHours() - START_HOUR) * 60 + d.getMinutes()) / 15 * SLOT_PX
    const height = Math.max(SLOT_PX, a.durationMinutes / 15 * SLOT_PX - 2)
    return (
      <button key={a.id} type="button" onClick={() => setSelected(a)} style={{ top, height }}
        className={cn('absolute inset-x-1 overflow-hidden rounded-lg border-s-4 border px-1.5 py-0.5 text-start text-[0.72rem] leading-tight shadow-sm', STATUS_STYLE[a.status])}>
        <span className="me-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: typeColor(a.type) }} /><b>{format(d, 'HH:mm')}</b> {a.patient ? `${a.patient.lastName} ${a.patient.firstName}` : ''}
        {a.reason && <span className="block truncate opacity-80">{a.reason}</span>}
      </button>
    )
  }

  const offBanner = (day: Date) => absencesOn(day).map(a => (
    <p key={a.id} className="mb-2 flex items-center gap-2 rounded-xl bg-[#F1F3F2] px-3 py-2 text-sm text-muted-foreground"><CalendarOff size={15} />{absenceLabel(a)}</p>
  ))

  /** Grey hatched band over the hours of an absence in a day column (the slots stay clickable underneath). */
  const offBlocks = (day: Date, who?: string) => absencesOn(day, who).map(a => {
    const dayStart = startOfDay(day).getTime() + START_HOUR * 3_600_000
    const from = Math.max(new Date(a.startsAt).getTime(), dayStart)
    const to = Math.min(new Date(a.endsAt).getTime(), startOfDay(day).getTime() + END_HOUR * 3_600_000)
    if (to <= from) return null
    const top = (from - dayStart) / 900_000 * SLOT_PX
    return (
      <div key={a.id} className="pointer-events-none absolute inset-x-0 z-[1] flex items-start justify-center bg-[repeating-linear-gradient(45deg,rgba(214,220,217,.55),rgba(214,220,217,.55)_6px,rgba(244,246,245,.55)_6px,rgba(244,246,245,.55)_12px)] pt-2"
        style={{ top, height: (to - from) / 900_000 * SLOT_PX }}>
        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[0.72rem] font-semibold text-muted-foreground shadow-sm"><CalendarOff size={11} className="me-1 inline" />{absenceLabel(a)}</span>
      </div>
    )
  })

  const list = (items: Appointment[]) => items.length === 0
    ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{L('Aucun rendez-vous.')}</p>
    : (
      <ul className="space-y-2">
        {items.map(a => (
          <li key={a.id}>
            <button type="button" onClick={() => setSelected(a)} className={cn('flex w-full items-center gap-3 rounded-xl border-s-4 border p-3 text-start', STATUS_STYLE[a.status])}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: typeColor(a.type) }} aria-hidden />
              <span className="w-12 shrink-0 font-mono text-sm font-bold">{format(new Date(a.date), 'HH:mm')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{a.patient ? `${a.patient.lastName} ${a.patient.firstName}` : '—'}</span>
                <span className="block truncate text-xs opacity-80">{[a.reason, !ownOnly && practitionerName(a.practitioner), `${a.durationMinutes} min`].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold">{t(`appointmentStatus.${a.status}`)}</span>
            </button>
          </li>
        ))}
      </ul>
    )

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.agenda')} actions={<>
        <Button variant="outline" onClick={() => setAbsencesOpen(true)}><CalendarOff size={17} className="me-1.5" />{L('Congés')}</Button>
        <Button onClick={() => setCreating({})}><Plus size={17} className="me-1.5" />{L('Rendez-vous')}</Button>
      </>} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => move(-1)} aria-label={L('Précédent')}><ChevronLeft size={18} className="rtl:rotate-180" /></Button>
          <Button variant="outline" onClick={() => setCursor(startOfDay(new Date()))}>{L('Aujourd’hui')}</Button>
          <Button size="icon" variant="outline" onClick={() => move(1)} aria-label={L('Suivant')}><ChevronRight size={18} className="rtl:rotate-180" /></Button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold capitalize">{title}</h2>
        {!ownOnly && practitioners.length > 1 && (
          <NativeSelect className="w-auto" aria-label={L('Praticien')} value={practitionerId} onChange={e => setPractitionerId(e.target.value)}>
            <option value="">{L('Tous les praticiens')}</option>
            {practitioners.map(p => <option key={p.id} value={p.id}>{practitionerName(p)}</option>)}
          </NativeSelect>
        )}
        <div role="group" aria-label={L('Vue')} className="flex gap-1 rounded-xl bg-muted p-1">
          {(['day', 'week', 'month'] as View[]).map(v => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn('h-8 rounded-lg px-3 text-sm font-semibold', view === v ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground')}>
              {v === 'day' ? L('Jour') : v === 'week' ? L('Semaine') : L('Mois')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-muted-foreground" aria-label={L('Légende')}>
        {APPOINTMENT_TYPES.map(x => <span key={x.value} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />{L(x.label)}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-[repeating-linear-gradient(45deg,#E3E7E5,#E3E7E5_3px,#F4F6F5_3px,#F4F6F5_6px)] ring-1 ring-[#D0D7D4]" />{L('Absence / fermeture')}</span>
      </div>

      {view === 'month' ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[560px] grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border bg-border">
            {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(d => <div key={d} className="bg-muted p-2 text-center text-xs font-semibold uppercase text-muted-foreground">{d}</div>)}
            {Array.from({ length: Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) }, (_, i) => addDays(range.from, i)).map(day => {
              const count = appointments.filter(a => isSameDay(new Date(a.date), day) && a.status !== 'CANCELLED').length
              const off = absencesOn(day)
              return (
                <button key={day.toISOString()} type="button" onClick={() => { setCursor(day); setView('day') }}
                  className={cn('min-h-[72px] bg-white p-2 text-start hover:bg-muted', off.some(a => !a.practitionerId) && 'bg-[#F1F3F2]', !isSameMonth(day, cursor) && 'text-muted-foreground/60', isSameDay(day, new Date()) && 'ring-2 ring-inset ring-primary')}>
                  <span className="text-sm font-semibold">{format(day, 'd')}</span>
                  {count > 0 && <span className="mt-1 block w-fit rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary">{count} RDV</span>}
                  {off.map(a => <span key={a.id} className="mt-1 block truncate text-[0.7rem] text-muted-foreground"><CalendarOff size={11} className="me-0.5 inline" />{absenceLabel(a)}</span>)}
                </button>
              )
            })}
          </div>
        </div>
      ) : !isTablet ? (
        // F-AGD-05: phone shows a list of the day (or of each day of the week).
        view === 'day' ? <div className="space-y-2">{offBanner(cursor)}{list(appointments)}</div> : (
          <div className="space-y-4">
            {columns.map(col => (
              <section key={col.key}><h3 className="mb-2 text-sm font-bold capitalize">{col.label}</h3>{offBanner(col.day)}{list(appointments.filter(a => isSameDay(new Date(a.date), col.day)))}</section>
            ))}
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[#D8E1DD] bg-white">
          <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${Math.max(1, columns.length)}, minmax(140px, 1fr))` }}>
            <div className="sticky top-0 border-b border-border bg-muted" />
            {columns.map(col => <div key={col.key} className="truncate border-b border-s border-border bg-muted p-2 text-center text-sm font-semibold capitalize">{col.label}</div>)}
            <div className="relative" style={{ height: (END_HOUR - START_HOUR) * 4 * SLOT_PX }}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <span key={i} className="absolute end-2 -translate-y-1/2 font-mono text-[0.7rem] text-muted-foreground" style={{ top: i * 4 * SLOT_PX }}>{String(START_HOUR + i).padStart(2, '0')}:00</span>
              ))}
            </div>
            {columns.map(col => (
              <div key={col.key} className="relative border-s border-border" style={{ height: (END_HOUR - START_HOUR) * 4 * SLOT_PX }}>
                {Array.from({ length: (END_HOUR - START_HOUR) * 4 }, (_, i) => (
                  <button key={i} type="button" aria-label={`${L('Créer un rendez-vous à')} ${String(START_HOUR + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`}
                    onClick={() => { const d = new Date(col.day); d.setHours(START_HOUR + Math.floor(i / 4), (i % 4) * 15, 0, 0); setCreating({ date: d, practitionerId: col.practitionerId }) }}
                    className={cn('absolute inset-x-0 hover:bg-accent/60', i % 4 === 0 && 'border-t border-border/70')} style={{ top: i * SLOT_PX, height: SLOT_PX }} />
                ))}
                {offBlocks(col.day, view === 'day' ? col.practitionerId : undefined)}
                {appointments.filter(a => isSameDay(new Date(a.date), col.day) && (view === 'week' || a.practitionerId === col.practitionerId)).map(block)}
              </div>
            ))}
          </div>
        </div>
      )}

      <AppointmentDialog open={creating !== null || editing !== null} onOpenChange={(open) => { if (!open) { setCreating(null); setEditing(null) } }}
        appointment={editing} defaultDate={creating?.date} defaultPractitionerId={creating?.practitionerId} />
      <AbsencesDialog open={absencesOpen} onOpenChange={setAbsencesOpen} />
      <AppointmentActions appointment={selected} onClose={() => setSelected(null)} onEdit={setEditing} />
    </div>
  )
}
