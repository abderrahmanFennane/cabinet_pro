import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
import { CalendarOff, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useTeam } from '../../lib/hooks'
import { formatDateFR } from '../../lib/utils'
import { useL } from '../../lib/labels'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { NativeSelect } from '../ui/native-select'
import { Absence, MOROCCO_HOLIDAYS } from './appointmentTypes'

const REASONS = ['Congé', 'Formation', 'Congrès', 'Maladie', 'Jour férié']

/** Holidays and absences: list, add (one doctor or the whole cabinet, whole days), delete. */
export default function AbsencesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const L = useL()
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const { data: team = [] } = useTeam()
  const practitioners = team.filter(m => m.role === 'OWNER' || m.role === 'PRACTITIONER')
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN'
  const ownOnly = user?.role === 'PRACTITIONER'
  const today = format(new Date(), 'yyyy-MM-dd')
  const [who, setWho] = useState(ownOnly ? user!.id : '')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [reason, setReason] = useState('')
  // A secretary cannot close the whole cabinet: default to the first doctor.
  const target = who || (isOwner ? '' : practitioners[0]?.id || '')

  const { data: absences = [] } = useQuery({
    queryKey: ['absences', cabinetApi, 'upcoming'],
    queryFn: async () => (await api.get(`${cabinetApi}/appointments/absences`, { params: { from: new Date(`${today}T00:00`).toISOString() } })).data.data as Absence[],
    enabled: open,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['absences'] })
  const nameOf = (id: string | null) => (id ? practitionerName(team.find(m => m.id === id)) || L('Praticien') : L('Tout le cabinet'))

  // Whole days: from 00:00 on the first day to 00:00 the day after the last one.
  const span = (a: string, b: string) => ({ startsAt: new Date(`${a}T00:00`).toISOString(), endsAt: addDays(new Date(`${b}T00:00`), 1).toISOString() })
  const create = useMutation({
    mutationFn: () => api.post(`${cabinetApi}/appointments/absences`, { practitionerId: target || null, ...span(from, to), reason: reason || null }),
    onSuccess: (res) => {
      const booked = res.data.data?.booked
      booked ? toast.warning(res.data.message, { duration: 8000 }) : toast.success(L('Absence enregistrée'))
      setReason(''); refresh(); queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
    onError: (err) => toast.error(apiError(err)),
  })
  const holidays = useMutation({
    mutationFn: async () => {
      const year = new Date().getFullYear()
      const taken = new Set(absences.filter(a => !a.practitionerId).map(a => format(new Date(a.startsAt), 'yyyy-MM-dd')))
      let added = 0
      for (const y of [year, year + 1]) for (const [md, name] of MOROCCO_HOLIDAYS) {
        const day = `${y}-${md}`
        if (day < today || taken.has(day)) continue
        await api.post(`${cabinetApi}/appointments/absences`, { practitionerId: null, ...span(day, day), reason: name })
        added++
      }
      return added
    },
    onSuccess: (n) => { toast.success(n ? L('{n} jours fériés ajoutés').replace('{n}', String(n)) : L('Les jours fériés sont déjà dans l’agenda')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${cabinetApi}/appointments/absences/${id}`),
    onSuccess: () => { toast.success(L('Absence supprimée')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })

  const last = (a: Absence) => addDays(new Date(a.endsAt), -1)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{L('Congés et absences')}</DialogTitle>
          <DialogDescription>{L('Les jours d’absence apparaissent en gris dans l’agenda et ne peuvent plus être réservés.')}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); create.mutate() }}>
          {!ownOnly && (
            <div className="space-y-1.5"><Label htmlFor="abs-who">{L('Qui')}</Label>
              <NativeSelect id="abs-who" value={target} onChange={e => setWho(e.target.value)}>
                {isOwner && <option value="">{L('Tout le cabinet (fermeture)')}</option>}
                {practitioners.map(p => <option key={p.id} value={p.id}>{practitionerName(p)}</option>)}
              </NativeSelect>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="abs-from">{L('Du')}</Label><Input id="abs-from" type="date" value={from} onChange={e => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value) }} required /></div>
            <div className="space-y-1.5"><Label htmlFor="abs-to">{L('Au (inclus)')}</Label><Input id="abs-to" type="date" min={from} value={to} onChange={e => setTo(e.target.value)} required /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="abs-reason">{L('Motif')}</Label>
            <Input id="abs-reason" list="abs-reasons" value={reason} maxLength={120} onChange={e => setReason(e.target.value)} placeholder={L('ex. Congé annuel')} />
            <datalist id="abs-reasons">{REASONS.map(r => <option key={r} value={L(r)} />)}</datalist>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            {isOwner ? <Button type="button" variant="outline" disabled={holidays.isPending} onClick={() => holidays.mutate()}>{holidays.isPending ? L('Ajout…') : L('Ajouter les jours fériés du Maroc')}</Button> : <span />}
            <Button type="submit" disabled={create.isPending || (!target && !isOwner)}>{L('Ajouter l’absence')}</Button>
          </div>
        </form>
        <div className="mt-2 border-t border-border pt-3">
          <p className="mb-2 text-sm font-bold">{L('À venir')}</p>
          {absences.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{L('Aucune absence prévue.')}</p> : (
            <ul className="grid max-h-64 gap-1.5 overflow-y-auto">
              {absences.map(a => {
                const one = format(new Date(a.startsAt), 'yyyy-MM-dd') === format(last(a), 'yyyy-MM-dd')
                const mine = !ownOnly || a.practitionerId === user?.id
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-sm">
                    <CalendarOff size={16} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <b>{one ? formatDateFR(a.startsAt) : `${formatDateFR(a.startsAt)} → ${formatDateFR(last(a).toISOString())}`}</b>
                      <span className="block truncate text-xs text-muted-foreground">{[nameOf(a.practitionerId), a.reason && L(a.reason)].filter(Boolean).join(' · ')}</span>
                    </span>
                    {mine && (isOwner || a.practitionerId) && (
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={L('Supprimer')}
                        onClick={() => { if (window.confirm(L('Supprimer cette absence ?'))) remove.mutate(a.id) }}><Trash2 size={15} /></Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
