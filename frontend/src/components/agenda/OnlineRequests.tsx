import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ar, enGB, fr } from 'date-fns/locale'
import { Globe, Phone } from 'lucide-react'
import api from '../../lib/api'
import { practitionerName, useCabinetApi } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { Appointment } from '../../types'
import { Button } from '../ui/button'
import { useAppointmentStatus } from './AppointmentActions'

/** Appointments booked by patients on the online page, waiting for the cabinet to confirm them (hidden when none). */
export default function OnlineRequests({ showDoctor }: { showDoctor: boolean }) {
  const L = useL()
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith('ar') ? ar : i18n.language.startsWith('en') ? enGB : fr
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const setStatus = useAppointmentStatus()
  const { data: items = [] } = useQuery({
    queryKey: ['online-requests', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/appointments/online-requests`)).data.data as Appointment[],
    refetchInterval: 60_000,
  })
  if (!items.length) return null
  const decide = (a: Appointment, status: 'CONFIRMED' | 'CANCELLED') =>
    setStatus.mutate({ id: a.id, status }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['online-requests'] }) })

  return (
    <section className="rounded-[14px] border border-[#F2D2AE] bg-[#FFF8EE]">
      <div className="flex items-center gap-2.5 px-[18px] pb-2 pt-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FCEBD8] text-[#B8661B]"><Globe size={17} /></span>
        <h2 className="text-[1.08rem] font-bold">{L('Rendez-vous en ligne à confirmer')} <span className="text-[#B8661B]">({items.length})</span></h2>
      </div>
      <p className="px-[18px] text-[0.86rem] text-[#5A6B65]">{L('Appelez le patient si besoin, puis confirmez ou refusez.')}</p>
      <div className="mt-2">
        {items.map(a => (
          <div key={a.id} className="grid gap-2 border-t border-[#F2D2AE] px-[18px] py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center">
            <span className="font-semibold tabular-nums">{format(new Date(a.date), 'EEE d MMM', { locale })} · {format(new Date(a.date), 'HH:mm')}</span>
            <div className="min-w-0">
              <b className="block truncate">{a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—'}</b>
              <span className="flex flex-wrap items-center gap-x-2 text-[0.86rem] text-[#5A6B65]">
                {a.patient?.phone && <a href={`tel:${a.patient.phone.replace(/\s/g, '')}`} className="flex items-center gap-1 font-semibold text-primary" dir="ltr"><Phone size={13} />{a.patient.phone}</a>}
                {[a.reason, showDoctor ? practitionerName(a.practitioner) : null].filter(Boolean).join(' · ')}
              </span>
              {a.comment && <span className="mt-1 block whitespace-pre-line rounded-lg bg-white px-2.5 py-1.5 text-[0.86rem] italic text-[#3F514A]">« {a.comment} »</span>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={setStatus.isPending} onClick={() => decide(a, 'CONFIRMED')}>{L('Confirmer')}</Button>
              <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => decide(a, 'CANCELLED')}>{L('Refuser')}</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
