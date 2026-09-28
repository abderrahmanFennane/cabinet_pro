import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useTeam } from '../../lib/hooks'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { NativeSelect } from '../ui/native-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { PatientPicker } from './AppointmentDialog'

/** Patient arriving without an appointment: goes straight to the waiting room. */
export default function WalkInDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const { data: team = [] } = useTeam()
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(null)
  const [practitionerId, setPractitionerId] = useState('')
  const [reason, setReason] = useState('')
  const practitioners = team.filter(m => m.role === 'OWNER' || m.role === 'PRACTITIONER')

  useEffect(() => {
    if (open) setPractitionerId(user?.role === 'OWNER' ? '' : practitioners[0]?.id || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const add = useMutation({
    mutationFn: () => api.post(`${cabinetApi}/appointments/walk-in`, { patientId: picked!.id, practitionerId: practitionerId || undefined, reason: reason || null }),
    onSuccess: () => {
      toast.success('Patient ajouté à la salle d’attente')
      onOpenChange(false); setPicked(null); setReason('')
      queryClient.invalidateQueries({ queryKey: ['waiting-room'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Patient sans rendez-vous</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (picked) add.mutate() }}>
          <div className="space-y-1.5"><Label>Patient</Label><PatientPicker value={picked} onChange={setPicked} /></div>
          {user?.role !== 'PRACTITIONER' && (
            <div className="space-y-1.5"><Label htmlFor="wi-prac">Praticien</Label>
              <NativeSelect id="wi-prac" value={practitionerId} onChange={e => setPractitionerId(e.target.value)} required={user?.role !== 'OWNER'}>
                {user?.role === 'OWNER' && <option value="">Moi-même</option>}
                {practitioners.filter(p => p.id !== user?.id).map(p => <option key={p.id} value={p.id}>{practitionerName(p)}</option>)}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5"><Label htmlFor="wi-reason">Motif</Label><Input id="wi-reason" value={reason} onChange={e => setReason(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={!picked || add.isPending}>Ajouter à la salle d’attente</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
