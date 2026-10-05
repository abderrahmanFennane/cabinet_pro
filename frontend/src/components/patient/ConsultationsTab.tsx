import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { BookmarkPlus, CheckCircle2, Lock, Pencil, Plus, Stethoscope, Trash2 } from 'lucide-react'
import DiagnosisCodePicker from './DiagnosisCodePicker'
import VisitWrapUp from './VisitWrapUp'
import { profileFor } from '../../specialties/consultation'
import { NativeSelect } from '../ui/native-select'
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
import { useL } from '../../lib/labels'

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

type Draft = { reason: string; examination: string; diagnosis: string; diagnosisCode: string; plan: string; notes: string; vitals: Record<string, string>; correctionReason: string }
const emptyDraft: Draft = { reason: '', examination: '', diagnosis: '', diagnosisCode: '', plan: '', notes: '', vitals: {}, correctionReason: '' }
type Template = { id: string; name: string; reason: string | null; examination: string | null; diagnosis: string | null; diagnosisCode: string | null; plan: string | null; notes: string | null; shared: boolean; mine: boolean }

export default function ConsultationsTab({ patient, appointmentId }: { patient: Patient; appointmentId?: string | null }) {
  const L = useL()
  const { t } = useTranslation()
  const { user, hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const base = `${cabinetApi}/patients/${patient.id}/consultations`
  const queryClient = useQueryClient()
  const canWrite = hasPermissions('MANAGE_CONSULTATIONS')
  const [editing, setEditing] = useState<Consultation | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  // After "Terminer": prescription, payment and next appointment in the same window.
  const [wrapUp, setWrapUp] = useState(false)

  const { data: consultations = [] } = useQuery({
    queryKey: ['consultations', patient.id],
    queryFn: async () => (await api.get(base)).data.data as Consultation[],
  })
  const { data: templates = [] } = useQuery({
    queryKey: ['consultation-templates', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/consultation-templates`)).data.data as Template[],
    enabled: canWrite && editing !== null,
    staleTime: 5 * 60_000,
  })
  const [templateId, setTemplateId] = useState('')
  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const tpl = templates.find(x => x.id === id)
    if (!tpl) return
    // Fills the fields from the template; what was already typed is kept when the template has nothing for it.
    setDraft(d => ({
      ...d, reason: tpl.reason || d.reason, examination: tpl.examination || d.examination, diagnosis: tpl.diagnosis || d.diagnosis,
      diagnosisCode: tpl.diagnosisCode || d.diagnosisCode, plan: tpl.plan || d.plan, notes: tpl.notes || d.notes,
    }))
  }
  const saveTemplate = useMutation({
    mutationFn: ({ name, shared }: { name: string; shared: boolean }) => api.post(`${cabinetApi}/consultation-templates`, {
      name, shared, reason: draft.reason || null, examination: draft.examination || null, diagnosis: draft.diagnosis || null,
      diagnosisCode: draft.diagnosisCode || null, plan: draft.plan || null, notes: draft.notes || null,
    }),
    onSuccess: () => { toast.success(t('templates.saved')); queryClient.invalidateQueries({ queryKey: ['consultation-templates', cabinetApi] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api.delete(`${cabinetApi}/consultation-templates/${id}`),
    onSuccess: () => { setTemplateId(''); toast.success(t('templates.deleted')); queryClient.invalidateQueries({ queryKey: ['consultation-templates', cabinetApi] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const askTemplate = () => {
    const name = window.prompt(t('templates.namePrompt'), draft.diagnosis || draft.reason || '')
    if (!name?.trim()) return
    const shared = user?.role === 'OWNER' ? window.confirm(t('templates.shareConfirm')) : false
    saveTemplate.mutate({ name: name.trim(), shared })
  }

  useEffect(() => {
    if (!editing) return
    setTemplateId('')
    if (editing === 'new') { setDraft(emptyDraft); return }
    setDraft({
      reason: editing.reason || '', examination: editing.examination || '', diagnosis: editing.diagnosis || '', diagnosisCode: editing.diagnosisCode || '', plan: editing.plan || '', notes: editing.notes || '',
      vitals: Object.fromEntries(Object.entries(editing.vitals || {}).map(([k, v]) => [k, String(v)])), correctionReason: '',
    })
  }, [editing])

  // Opened from the waiting room with ?consult=<appointmentId>: start the consultation right away.
  useEffect(() => { if (appointmentId && canWrite) setEditing('new') }, [appointmentId, canWrite])

  const refresh = () => ['consultations', 'timeline', 'patient'].forEach(key => queryClient.invalidateQueries({ queryKey: [key, patient.id] }))

  const body = () => {
    const vitals = Object.fromEntries(Object.entries(draft.vitals).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]))
    return {
      reason: draft.reason || null, examination: draft.examination || null, diagnosis: draft.diagnosis || null, diagnosisCode: draft.diagnosisCode || null, plan: draft.plan || null, notes: draft.notes || null,
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
      toast.success(lock ? L('Consultation terminée') : L('Consultation enregistrée'))
      refresh()
      queryClient.invalidateQueries({ queryKey: ['waiting-room'] })
      if (lock) setWrapUp(true)
      else setEditing(null)
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const isLocked = editing !== null && editing !== 'new' && editing.status === 'LOCKED'
  // The form follows the specialty of the consultation (a new one: the doctor's own specialty).
  const profile = profileFor(editing && editing !== 'new' ? editing.specialty : user?.specialty)
  const shownVitals = VITALS.filter(v => profile.vitals.includes(v.key) || draft.vitals[v.key])
  const addExamHeading = (heading: string) => setDraft(d => ({ ...d, examination: `${d.examination.trim() ? `${d.examination.trimEnd()}\n` : ''}${heading} : ` }))
  const canEditExisting = (c: Consultation) => canWrite && (user?.role === 'OWNER' || c.practitionerId === user?.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{L('Consultations')}</h3>
        {canWrite && <Button size="sm" onClick={() => setEditing('new')}><Plus size={16} className="me-1" />{L('Nouvelle consultation')}</Button>}
      </div>
      {consultations.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{L('Aucune consultation.')}</p>}
      <ol className="space-y-3">
        {consultations.map(c => (
          <li key={c.id} className="space-y-2 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold"><Stethoscope size={15} className="me-1.5 inline text-primary" />{c.reason || 'Consultation'}</p>
                <p className="text-xs text-muted-foreground">{formatDateTimeFR(c.date)} · {practitionerName(c.practitioner)}{c.version > 1 ? ` · version ${c.version}` : ''}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {c.status === 'LOCKED' ? <Badge variant="secondary"><Lock size={12} className="me-1" />{L('Verrouillée')}</Badge> : <Badge variant="warning">{L('Brouillon')}</Badge>}
                {canEditExisting(c) && <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil size={14} className="me-1" />{c.status === 'LOCKED' ? 'Corriger' : 'Continuer'}</Button>}
              </div>
            </div>
            {c.vitals && <p className="text-sm text-muted-foreground">{vitalsText(c.vitals)}</p>}
            {c.examination && <p className="whitespace-pre-line text-sm"><b>{L('Examen :')} </b>{c.examination}</p>}
            {(c.diagnosis || c.diagnosisCode) && <p className="text-sm"><b>{L('Diagnostic :')} </b>{c.diagnosisCode && <span className="me-1.5 rounded bg-[#DCEEE7] px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">{c.diagnosisCode}</span>}{c.diagnosis}</p>}
            {c.plan && <p className="text-sm"><b>{L('Conduite à tenir :')} </b>{c.plan}</p>}
            {!!c.revisions?.length && <p className="text-xs text-muted-foreground">{c.revisions.length} {L('correction(s) datée(s) et signée(s) conservée(s).')}</p>}
          </li>
        ))}
      </ol>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) { setEditing(null); setWrapUp(false) } }}>
        <DialogContent className="sm:max-w-2xl">
          {wrapUp ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CheckCircle2 size={22} className="text-[#1E7A45]" />{L('Consultation terminée')}</DialogTitle>
                <DialogDescription>{patient.lastName} {patient.firstName} · {L('Ordonnance, paiement et prochain rendez-vous : tout se fait ici.')}</DialogDescription>
              </DialogHeader>
              <VisitWrapUp patient={patient} onClose={() => { setEditing(null); setWrapUp(false) }} />
            </>
          ) : (<>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? L('Nouvelle consultation') : isLocked ? L('Corriger la consultation') : L('Consultation')}</DialogTitle>
            <DialogDescription>{isLocked ? L('La consultation est verrouillée : la correction crée une nouvelle version datée, la précédente est conservée.') : `${patient.lastName} ${patient.firstName}`}</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(false) }}>
            {!isLocked && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#F2F5F3] p-2">
                <NativeSelect aria-label={t('templates.use')} value={templateId} onChange={e => applyTemplate(e.target.value)} className="h-9 w-auto min-w-[12rem] flex-1 bg-white">
                  <option value="">{templates.length ? t('templates.use') : t('templates.none')}</option>
                  {templates.map(x => <option key={x.id} value={x.id}>{x.name}{x.shared ? ` · ${t('templates.shared')}` : ''}</option>)}
                </NativeSelect>
                {templateId && templates.find(x => x.id === templateId && (x.mine || (x.shared && user?.role === 'OWNER'))) && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { if (window.confirm(t('templates.deleteConfirm'))) deleteTemplate.mutate(templateId) }} aria-label={t('templates.delete')}><Trash2 size={15} /></Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={askTemplate} disabled={saveTemplate.isPending || !(draft.reason || draft.diagnosis || draft.plan)}><BookmarkPlus size={15} className="me-1.5" />{t('templates.save')}</Button>
              </div>
            )}
            <div className="space-y-1.5"><Label htmlFor="c-reason">{L('Motif')}</Label><Input id="c-reason" value={draft.reason} onChange={e => setDraft(d => ({ ...d, reason: e.target.value }))} />
              {!isLocked && (
                <div className="flex flex-wrap gap-1.5" aria-label={t('consultForm.frequentReasons')}>
                  {profile.reasons.map(r => (
                    <button key={r} type="button" onClick={() => setDraft(d => ({ ...d, reason: d.reason && !d.reason.includes(L(r)) ? `${d.reason}, ${L(r).toLowerCase()}` : L(r) }))}
                      className="rounded-full border border-[#D8E1DD] bg-white px-2.5 py-1 text-[0.8rem] hover:border-primary hover:text-primary">{L(r)}</button>
                  ))}
                </div>
              )}
            </div>
            {shownVitals.length > 0 && <fieldset>
              <legend className="mb-1.5 text-sm font-medium">{L('Constantes')}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {shownVitals.map(v => (
                  <label key={v.key} className="space-y-1 text-xs text-muted-foreground">
                    {L(v.label)} ({v.unit})
                    <Input type="number" step="any" inputMode="decimal" value={draft.vitals[v.key] || ''} onChange={e => setDraft(d => ({ ...d, vitals: { ...d.vitals, [v.key]: e.target.value } }))} />
                  </label>
                ))}
              </div>
            </fieldset>}
            <div className="space-y-1.5">
              <Label htmlFor="c-exam">{profile.examLabel ? L(profile.examLabel) : L('Examen clinique')}</Label>
              {!isLocked && (
                <div className="flex flex-wrap gap-1.5" aria-label={t('consultForm.examHeadings')}>
                  {profile.exam.map(h => <button key={h} type="button" onClick={() => addExamHeading(L(h))} className="rounded-lg bg-[#F2F5F3] px-2 py-1 text-[0.78rem] font-semibold text-[#3F514A] hover:bg-[#DCEEE7] hover:text-primary">+ {L(h)}</button>)}
                </div>
              )}
              <Textarea id="c-exam" rows={4} value={draft.examination} onChange={e => setDraft(d => ({ ...d, examination: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="space-y-1.5"><Label htmlFor="c-diag">{L('Diagnostic')}</Label><Input id="c-diag" value={draft.diagnosis} onChange={e => setDraft(d => ({ ...d, diagnosis: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>{t('icd.label')}</Label>
                <DiagnosisCodePicker value={draft.diagnosisCode} onPick={c => setDraft(d => ({ ...d, diagnosisCode: c?.code || '', diagnosis: d.diagnosis || c?.label || '' }))} />
              </div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="c-plan">{profile.planLabel ? L(profile.planLabel) : L('Conduite à tenir')}</Label><Textarea id="c-plan" rows={2} value={draft.plan} onChange={e => setDraft(d => ({ ...d, plan: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-notes">{L('Notes')}</Label><Textarea id="c-notes" rows={2} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></div>
            {isLocked && <div className="space-y-1.5"><Label htmlFor="c-corr">{L('Motif de la correction')}</Label><Input id="c-corr" value={draft.correctionReason} onChange={e => setDraft(d => ({ ...d, correctionReason: e.target.value }))} required minLength={3} /></div>}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {isLocked ? (
                <Button type="submit" disabled={save.isPending}>{L('Enregistrer la correction')}</Button>
              ) : (
                <>
                  <Button type="submit" variant="outline" disabled={save.isPending}>{L('Enregistrer le brouillon')}</Button>
                  <Button type="button" onClick={() => save.mutate(true)} disabled={save.isPending}><Lock size={15} className="me-1.5" />{L('Terminer et verrouiller')}</Button>
                </>
              )}
            </div>
          </form>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  )
}
