import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lock, Pencil, Plus, Stethoscope } from 'lucide-react'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi } from '../../lib/hooks'
import { formatDateTimeFR } from '../../lib/utils'
import { Consultation, Patient, Vitals } from '../../types'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'

const VITALS: { key: keyof Vitals; label: string; unit: string }[] = [
  { key: 'systolic', label: 'TA systolique', unit: 'mmHg' },
  { key: 'diastolic', label: 'TA diastolique', unit: 'mmHg' },
  { key: 'pulse', label: 'Pouls', unit: '/min' },
  { key: 'temperature', label: 'Température', unit: '°C' },
  { key: 'weight', label: 'Poids', unit: 'kg' },
  { key: 'height', label: 'Taille', unit: 'cm' },
  { key: 'glucose', label: 'Glycémie', unit: 'g/L' },
  { key: 'spo2', label: 'SpO₂', unit: '%' },
]

const vitalsText = (v: Vitals | null) => {
  if (!v) return ''
  const parts = []
  if (v.systolic && v.diastolic) parts.push(`TA ${v.systolic}/${v.diastolic}`)
  if (v.pulse) parts.push(`FC ${v.pulse}`)
  if (v.temperature) parts.push(`${v.temperature} °C`)
  if (v.weight) parts.push(`${v.weight} kg`)
  if (v.glucose) parts.push(`Gly ${v.glucose} g/L`)
  return parts.join(' · ')
}

type Draft = { reason: string; examination: string; diagnosis: string; plan: string; notes: string; vitals: Record<string, string>; correctionReason: string }
const emptyDraft: Draft = { reason: '', examination: '', diagnosis: '', plan: '', notes: '', vitals: {}, correctionReason: '' }

export default function ConsultationsTab({ patient, appointmentId }: { patient: Patient; appointmentId?: string | null }) {
  const { user, hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const base = `${cabinetApi}/patients/${patient.id}/consultations`
  const queryClient = useQueryClient()
  const canWrite = hasPermissions('MANAGE_CONSULTATIONS')
  const [editing, setEditing] = useState<Consultation | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  const { data: consultations = [] } = useQuery({
    queryKey: ['consultations', patient.id],
    queryFn: async () => (await api.get(base)).data.data as Consultation[],
  })

  useEffect(() => {
    if (!editing) return
    if (editing === 'new') { setDraft(emptyDraft); return }
    setDraft({
      reason: editing.reason || '', examination: editing.examination || '', diagnosis: editing.diagnosis || '', plan: editing.plan || '', notes: editing.notes || '',
      vitals: Object.fromEntries(Object.entries(editing.vitals || {}).map(([k, v]) => [k, String(v)])), correctionReason: '',
    })
  }, [editing])

  // Opened from the waiting room with ?consult=<appointmentId>: start the consultation right away.
  useEffect(() => { if (appointmentId && canWrite) setEditing('new') }, [appointmentId, canWrite])

  const refresh = () => ['consultations', 'timeline', 'patient'].forEach(key => queryClient.invalidateQueries({ queryKey: [key, patient.id] }))

  const body = () => {
    const vitals = Object.fromEntries(Object.entries(draft.vitals).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]))
    return {
      reason: draft.reason || null, examination: draft.examination || null, diagnosis: draft.diagnosis || null, plan: draft.plan || null, notes: draft.notes || null,
      vitals: Object.keys(vitals).length ? vitals : null,
    }
  }

  const save = useMutation({
    mutationFn: async (lock: boolean) => {
      let id: string
      if (editing === 'new') {
        id = (await api.post(base, { ...body(), appointmentId: appointmentId || null })).data.data.id
      } else {
        id = editing!.id
        await api.patch(`${base}/${id}`, { ...body(), ...(editing!.status === 'LOCKED' ? { correctionReason: draft.correctionReason } : {}) })
      }
      if (lock) await api.post(`${base}/${id}/lock`)
    },
    onSuccess: (_, lock) => {
      toast.success(lock ? 'Consultation terminée' : 'Consultation enregistrée')
      refresh()
      queryClient.invalidateQueries({ queryKey: ['waiting-room'] })
      setEditing(null)
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const isLocked = editing !== null && editing !== 'new' && editing.status === 'LOCKED'
  const canEditExisting = (c: Consultation) => canWrite && (user?.role === 'OWNER' || c.practitionerId === user?.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Consultations</h3>
        {canWrite && <Button size="sm" onClick={() => setEditing('new')}><Plus size={16} className="me-1" />Nouvelle consultation</Button>}
      </div>
      {consultations.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aucune consultation.</p>}
      <ol className="space-y-3">
        {consultations.map(c => (
          <li key={c.id} className="space-y-2 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold"><Stethoscope size={15} className="me-1.5 inline text-primary" />{c.reason || 'Consultation'}</p>
                <p className="text-xs text-muted-foreground">{formatDateTimeFR(c.date)} · {practitionerName(c.practitioner)}{c.version > 1 ? ` · version ${c.version}` : ''}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {c.status === 'LOCKED' ? <Badge variant="secondary"><Lock size={12} className="me-1" />Verrouillée</Badge> : <Badge variant="warning">Brouillon</Badge>}
                {canEditExisting(c) && <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil size={14} className="me-1" />{c.status === 'LOCKED' ? 'Corriger' : 'Continuer'}</Button>}
              </div>
            </div>
            {c.vitals && <p className="text-sm text-muted-foreground">{vitalsText(c.vitals)}</p>}
            {c.examination && <p className="whitespace-pre-line text-sm"><b>Examen : </b>{c.examination}</p>}
            {c.diagnosis && <p className="text-sm"><b>Diagnostic : </b>{c.diagnosis}</p>}
            {c.plan && <p className="text-sm"><b>Conduite à tenir : </b>{c.plan}</p>}
            {!!c.revisions?.length && <p className="text-xs text-muted-foreground">{c.revisions.length} correction(s) datée(s) et signée(s) conservée(s).</p>}
          </li>
        ))}
      </ol>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Nouvelle consultation' : isLocked ? 'Corriger la consultation' : 'Consultation'}</DialogTitle>
            <DialogDescription>{isLocked ? 'La consultation est verrouillée : la correction crée une nouvelle version datée, la précédente est conservée.' : `${patient.lastName} ${patient.firstName}`}</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(false) }}>
            <div className="space-y-1.5"><Label htmlFor="c-reason">Motif</Label><Input id="c-reason" value={draft.reason} onChange={e => setDraft(d => ({ ...d, reason: e.target.value }))} /></div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Constantes</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VITALS.map(v => (
                  <label key={v.key} className="space-y-1 text-xs text-muted-foreground">
                    {v.label} ({v.unit})
                    <Input type="number" step="any" inputMode="decimal" value={draft.vitals[v.key] || ''} onChange={e => setDraft(d => ({ ...d, vitals: { ...d.vitals, [v.key]: e.target.value } }))} />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1.5"><Label htmlFor="c-exam">Examen clinique</Label><Textarea id="c-exam" rows={3} value={draft.examination} onChange={e => setDraft(d => ({ ...d, examination: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-diag">Diagnostic</Label><Input id="c-diag" value={draft.diagnosis} onChange={e => setDraft(d => ({ ...d, diagnosis: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-plan">Conduite à tenir</Label><Textarea id="c-plan" rows={2} value={draft.plan} onChange={e => setDraft(d => ({ ...d, plan: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-notes">Notes</Label><Textarea id="c-notes" rows={2} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></div>
            {isLocked && <div className="space-y-1.5"><Label htmlFor="c-corr">Motif de la correction</Label><Input id="c-corr" value={draft.correctionReason} onChange={e => setDraft(d => ({ ...d, correctionReason: e.target.value }))} required minLength={3} /></div>}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {isLocked ? (
                <Button type="submit" disabled={save.isPending}>Enregistrer la correction</Button>
              ) : (
                <>
                  <Button type="submit" variant="outline" disabled={save.isPending}>Enregistrer le brouillon</Button>
                  <Button type="button" onClick={() => save.mutate(true)} disabled={save.isPending}><Lock size={15} className="me-1.5" />Terminer et verrouiller</Button>
                </>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
