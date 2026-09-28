import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useCabinetPath } from '../../lib/hooks'
import { formatDateTimeFR } from '../../lib/utils'
import { Appointment, AppointmentStatus } from '../../types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'

export const STATUS_STYLE: Record<AppointmentStatus, string> = {
  PLANNED: 'border-[#B5CCC2] bg-[#E9EFEC] text-[#14231E]',
  CONFIRMED: 'border-[#12705A] bg-[#DCEEE7] text-[#0D4A3B]',
  ARRIVED: 'border-[#B87700] bg-[#FFF3D4] text-[#8A5A00]',
  IN_CONSULTATION: 'border-[#6947A6] bg-[#ECE6F7] text-[#5731B7]',
  DONE: 'border-[#D8E1DD] bg-[#E9EEED] text-[#5A6B65]',
  CANCELLED: 'border-[#D8E1DD] bg-white text-[#8A9A94] line-through',
  NO_SHOW: 'border-[#F3CFCB] bg-[#F8E1DF] text-[#B23A33]',
}

const NEXT: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  PLANNED: ['CONFIRMED', 'ARRIVED', 'NO_SHOW', 'CANCELLED'],
  CONFIRMED: ['ARRIVED', 'NO_SHOW', 'CANCELLED'],
  ARRIVED: ['IN_CONSULTATION', 'NO_SHOW'],
  IN_CONSULTATION: ['DONE'],
}

export function useAppointmentStatus() {
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => api.post(`${cabinetApi}/appointments/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['waiting-room'] })
    },
    onError: (err) => toast.error(apiError(err)),
  })
}

type Props = { appointment: Appointment | null; onClose: () => void; onEdit: (a: Appointment) => void }

export default function AppointmentActions({ appointment, onClose, onEdit }: Props) {
  const { t } = useTranslation()
  const { hasPermissions } = useAuth()
  const navigate = useNavigate()
  const cabinetPath = useCabinetPath()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const setStatus = useAppointmentStatus()
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${cabinetApi}/appointments/${id}`),
    onSuccess: () => { toast.success('Rendez-vous supprimé'); queryClient.invalidateQueries({ queryKey: ['appointments'] }); onClose() },
    onError: (err) => toast.error(apiError(err)),
  })
  if (!appointment) return null
  const a = appointment
  const change = (status: AppointmentStatus) => setStatus.mutate({ id: a.id, status }, {
    onSuccess: () => {
      onClose()
      if (status === 'IN_CONSULTATION' && a.patientId && hasPermissions('MANAGE_CONSULTATIONS')) navigate(cabinetPath(`/patients/${a.patientId}?consult=${a.id}`))
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{a.patient ? `${a.patient.lastName} ${a.patient.firstName}` : 'Rendez-vous'}</DialogTitle>
          <DialogDescription>{formatDateTimeFR(a.date)} · {a.durationMinutes} min · {practitionerName(a.practitioner)}</DialogDescription>
        </DialogHeader>
        <p className="text-sm"><span className="text-muted-foreground">Statut : </span><b>{t(`appointmentStatus.${a.status}`)}</b>{a.reason ? <><span className="text-muted-foreground"> · Motif : </span>{a.reason}</> : null}</p>
        {!!NEXT[a.status]?.length && (
          <div className="flex flex-wrap gap-2">
            {NEXT[a.status]!.map(s => (
              <Button key={s} size="sm" variant={s === 'CANCELLED' || s === 'NO_SHOW' ? 'outline' : 'default'} onClick={() => change(s)} disabled={setStatus.isPending}>
                {s === 'IN_CONSULTATION' ? 'Faire entrer' : t(`appointmentStatus.${s}`)}
              </Button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          {a.patientId && <Button variant="outline" onClick={() => navigate(cabinetPath(`/patients/${a.patientId}`))}>Dossier</Button>}
          {!['DONE', 'CANCELLED'].includes(a.status) && <Button variant="outline" onClick={() => { onClose(); onEdit(a) }}>Déplacer</Button>}
          <Button variant="ghost" onClick={() => { if (window.confirm('Supprimer ce rendez-vous ?')) remove.mutate(a.id) }}>Supprimer</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
