import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useDebouncedValue, useTeam } from '../../lib/hooks'
import { Appointment, Patient } from '../../types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { NativeSelect } from '../ui/native-select'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment?: Appointment | null
  patient?: { id: string; firstName: string; lastName: string } | null
  defaultDate?: Date
  defaultPractitionerId?: string
}

const TYPES = [
  { value: 'CONSULTATION', label: 'Consultation', minutes: 30 },
  { value: 'CONTROL', label: 'Contrôle', minutes: 20 },
  { value: 'CARE', label: 'Soins', minutes: 45 },
  { value: 'SURGERY', label: 'Chirurgie', minutes: 60 },
  { value: 'EMERGENCY', label: 'Urgence', minutes: 20 },
]

export function PatientPicker({ value, onChange }: { value: { id: string; label: string } | null; onChange: (p: { id: string; label: string } | null) => void }) {
  const cabinetApi = useCabinetApi()
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim())
  const { data: found = [] } = useQuery({
    queryKey: ['patients', 'picker', cabinetApi, term],
    queryFn: async () => (await api.get(`${cabinetApi}/patients`, { params: { search: term, limit: 8 } })).data.data as Patient[],
    enabled: term.length >= 2 && !value,
    placeholderData: keepPreviousData,
  })
  const results = search.trim().length >= 2 ? found : []
  if (value) {
    return (
      <div className="flex h-10 items-center justify-between rounded-xl border border-input bg-muted px-3 text-sm">
        <span className="font-semibold">{value.label}</span>
        <button type="button" className="text-xs font-semibold text-primary" onClick={() => onChange(null)}>Changer</button>
      </div>
    )
  }
  return (
    <div className="relative">
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, téléphone ou CIN…" aria-label="Rechercher un patient" />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-lg">
          {results.map(p => (
            <li key={p.id}>
              <button type="button" className="w-full rounded-lg px-2.5 py-2 text-start text-sm hover:bg-muted" onClick={() => { onChange({ id: p.id, label: `${p.lastName} ${p.firstName}` }); setSearch('') }}>
                <b>{p.lastName} {p.firstName}</b> <span className="text-muted-foreground">{[p.phone, p.age !== null && `${p.age} ans`].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AppointmentDialog({ open, onOpenChange, appointment, patient, defaultDate, defaultPractitionerId }: Props) {
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const { data: team = [] } = useTeam()
  const practitioners = team.filter(u => u.role === 'OWNER' || u.role === 'PRACTITIONER')
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(null)
  const [practitionerId, setPractitionerId] = useState('')
  const [day, setDay] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('CONSULTATION')
  const [duration, setDuration] = useState('30')
  const [reason, setReason] = useState('')
  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    if (!open) return
    const start = appointment ? new Date(appointment.date) : defaultDate || nextSlot()
    const p = appointment?.patient || patient
    setPicked(p ? { id: p.id, label: `${p.lastName} ${p.firstName}` } : null)
    setPractitionerId(appointment?.practitionerId || defaultPractitionerId || (user?.role === 'OWNER' || user?.role === 'PRACTITIONER' ? user.id : practitioners[0]?.id || ''))
    setDay(format(start, 'yyyy-MM-dd'))
    setTime(format(start, 'HH:mm'))
    setType(appointment?.type || 'CONSULTATION')
    setDuration(String(appointment?.durationMinutes || 30))
    setReason(appointment?.reason || '')
    setConflict(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment, patient, defaultDate, defaultPractitionerId])

  const save = useMutation({
    mutationFn: (force: boolean) => {
      const body = { patientId: picked!.id, practitionerId, date: new Date(`${day}T${time}`).toISOString(), durationMinutes: Number(duration), type, reason: reason || null, force }
      return appointment ? api.patch(`${cabinetApi}/appointments/${appointment.id}`, body) : api.post(`${cabinetApi}/appointments`, body)
    },
    onSuccess: () => {
      toast.success(appointment ? 'Rendez-vous déplacé' : 'Rendez-vous créé')
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['waiting-room'] })
      queryClient.invalidateQueries({ queryKey: ['patient'] })
      onOpenChange(false)
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) setConflict(true)
      toast.error(apiError(err))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{appointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}</DialogTitle>
          <DialogDescription>Le patient recevra un rappel automatique s’il a donné son accord.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (picked) save.mutate(false) }}>
          <div className="space-y-1.5"><Label>Patient</Label>{patient ? <p className="font-semibold">{patient.lastName} {patient.firstName}</p> : <PatientPicker value={picked} onChange={setPicked} />}</div>
          {user?.role !== 'PRACTITIONER' && (
            <div className="space-y-1.5"><Label htmlFor="practitioner">Praticien</Label>
              <NativeSelect id="practitioner" value={practitionerId} onChange={e => setPractitionerId(e.target.value)} required>
                {practitioners.map(p => <option key={p.id} value={p.id}>{practitionerName(p)}</option>)}
              </NativeSelect>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="day">Date</Label><Input id="day" type="date" value={day} onChange={e => setDay(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label htmlFor="time">Heure</Label><Input id="time" type="time" step={300} value={time} onChange={e => setTime(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label htmlFor="type">Type</Label>
              <NativeSelect id="type" value={type} onChange={e => { setType(e.target.value); setDuration(String(TYPES.find(x => x.value === e.target.value)?.minutes || 30)) }}>
                {TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="duration">Durée (min)</Label><Input id="duration" type="number" min={5} step={5} value={duration} onChange={e => setDuration(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="reason">Motif (usage interne, jamais envoyé au patient)</Label><Input id="reason" value={reason} onChange={e => setReason(e.target.value)} /></div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {conflict && <Button type="button" variant="outline" onClick={() => save.mutate(true)}>Enregistrer malgré le chevauchement</Button>}
            <Button type="submit" disabled={!picked || save.isPending}>{appointment ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function nextSlot() {
  const d = new Date()
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return d
}
