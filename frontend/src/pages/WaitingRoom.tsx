import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Clock, DoorOpen, UserPlus } from 'lucide-react'
import api from '../lib/api'
import { practitionerName, useAuth, useCabinetApi, useCabinetPath } from '../lib/hooks'
import { cn } from '../lib/utils'
import { Appointment, AppointmentStatus } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import WalkInDialog from '../components/agenda/WalkInDialog'
import { STATUS_STYLE, useAppointmentStatus } from '../components/agenda/AppointmentActions'
import { useL } from '../lib/labels'

/** F-AGD-03: real-time waiting room for the assistant and the practitioner, with waiting times and walk-ins. */
export default function WaitingRoom() {
  const L = useL()
  const { t } = useTranslation()
  const { user, hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const navigate = useNavigate()
  const setStatus = useAppointmentStatus()
  const [walkIn, setWalkIn] = useState(false)

  const { data: items = [] } = useQuery({
    queryKey: ['waiting-room', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/appointments/waiting-room`)).data.data as Appointment[],
    refetchInterval: 15_000,
  })

  const groups: { title: string; statuses: AppointmentStatus[]; empty: string }[] = [
    { title: L('En salle d’attente'), statuses: ['ARRIVED'], empty: L('Personne en attente.') },
    { title: L('En consultation'), statuses: ['IN_CONSULTATION'], empty: L('Aucune consultation en cours.') },
    { title: L('À venir aujourd’hui'), statuses: ['PLANNED', 'CONFIRMED'], empty: L('Plus de rendez-vous prévus.') },
    { title: L('Terminés et absents'), statuses: ['DONE', 'NO_SHOW'], empty: '—' },
  ]

  const bringIn = (a: Appointment) => setStatus.mutate({ id: a.id, status: 'IN_CONSULTATION' }, {
    onSuccess: () => { if (hasPermissions('MANAGE_CONSULTATIONS') && a.patientId && (user?.id === a.practitionerId || user?.role === 'OWNER')) navigate(cabinetPath(`/patients/${a.patientId}?consult=${a.id}`)) },
  })

  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.waitingRoom')} subtitle={format(new Date(), 'dd/MM/yyyy')} actions={<Button onClick={() => setWalkIn(true)}><UserPlus size={17} className="me-1.5" />{L('Patient sans rendez-vous')}</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(group => {
          const list = items.filter(a => group.statuses.includes(a.status))
          return (
            <section key={group.title} className="space-y-2 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
              <h3 className="flex items-center justify-between font-bold">{group.title}<span className="rounded-full bg-muted px-2.5 py-0.5 text-sm">{list.length}</span></h3>
              {list.length === 0 ? <p className="text-sm text-muted-foreground">{group.empty}</p> : list.map(a => (
                <div key={a.id} className={cn('flex flex-wrap items-center gap-2 rounded-xl border-s-4 border p-3', STATUS_STYLE[a.status])}>
                  <div className="min-w-0 flex-1">
                    <button type="button" className="block truncate text-start font-semibold hover:underline" onClick={() => a.patientId && navigate(cabinetPath(`/patients/${a.patientId}`))}>
                      {a.patient ? `${a.patient.lastName} ${a.patient.firstName}` : '—'}{a.walkIn && <span className="ms-1.5 rounded bg-white/70 px-1.5 text-[0.65rem] font-bold uppercase">{L('sans RDV')}</span>}
                    </button>
                    <p className="truncate text-xs opacity-80">{[a.walkIn ? `${L('arrivé')} ${format(new Date(a.arrivedAt || a.date), 'HH:mm')}` : `${L('RDV')} ${format(new Date(a.date), 'HH:mm')}`, practitionerName(a.practitioner), a.reason].filter(Boolean).join(' · ')}</p>
                  </div>
                  {a.waitingMinutes !== null && a.waitingMinutes !== undefined && (
                    <span className={cn('flex items-center gap-1 text-sm font-bold', a.waitingMinutes >= 30 && 'text-[#B23A33]')}><Clock size={14} />{a.waitingMinutes} min</span>
                  )}
                  <div className="flex gap-1.5">
                    {(a.status === 'PLANNED' || a.status === 'CONFIRMED') && <>
                      <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: 'ARRIVED' })}>{L('Arrivé')}</Button>
                      {new Date(a.date) < new Date() && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: a.id, status: 'NO_SHOW' })}>{L('Absent')}</Button>}
                    </>}
                    {a.status === 'ARRIVED' && <Button size="sm" onClick={() => bringIn(a)}><DoorOpen size={15} className="me-1" />{L('Faire entrer')}</Button>}
                    {a.status === 'IN_CONSULTATION' && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: a.id, status: 'DONE' })}>{L('Terminé')}</Button>}
                  </div>
                </div>
              ))}
            </section>
          )
        })}
      </div>

      <WalkInDialog open={walkIn} onOpenChange={setWalkIn} />
    </div>
  )
}
