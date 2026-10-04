import { useState } from 'react'
import { toast } from 'sonner'
import { useL } from '../../lib/labels'
import { apiError, useCabinetApi, useCabinetId } from '../../lib/hooks'
import { openAttachment } from '../../lib/files'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { ClinicalRecord, today } from '../records'
import { Empty, Field, RecordMeta, Section } from '../ui'
import { Thumb, uploadImage } from '../ophthalmology/shared'

export type Risk = Record<'hypertension' | 'diabetes' | 'smoking' | 'dyslipidemia' | 'obesity' | 'familyHistory' | 'sedentary', boolean> & { notes?: string | null }
export type Reading = { systolic?: number | null; diastolic?: number | null; heartRate?: number | null; inr?: number | null; notes?: string | null }
export type Ecg = { rhythm?: string | null; rate?: number | null; pr?: number | null; qrs?: number | null; qtc?: number | null; axis?: number | null; interpretation?: string | null; attachmentId?: string | null }
export type Echo = { lvef?: number | null; method?: string | null; lvedd?: number | null; lvesd?: number | null; ivs?: number | null; pw?: number | null; lavi?: number | null; ee?: number | null; tapse?: number | null; paps?: number | null; valves?: string | null; pericardium?: string | null; conclusion?: string | null; attachmentId?: string | null }
export type Holter = { hours?: number | null; rhythm?: string | null; hrMin?: number | null; hrMean?: number | null; hrMax?: number | null; pvc?: number | null; pac?: number | null; longestPause?: number | null; afBurden?: number | null; nsvt?: number | null; symptoms?: string | null; conclusion?: string | null; attachmentId?: string | null }
export type Abpm = { sys24?: number | null; dia24?: number | null; sysDay?: number | null; diaDay?: number | null; sysNight?: number | null; diaNight?: number | null; hr24?: number | null; validReadings?: number | null; conclusion?: string | null; attachmentId?: string | null }
export type Stress = { protocol?: string | null; durationMin?: number | null; mets?: number | null; hrMax?: number | null; sbpMax?: number | null; stopReason?: string | null; symptoms?: string | null; stChanges?: string | null; arrhythmia?: string | null; result?: 'NEGATIVE' | 'POSITIVE' | 'INCONCLUSIVE' | 'NOT_DIAGNOSTIC' | null; conclusion?: string | null; attachmentId?: string | null }
export type Lab = { totalChol?: number | null; ldl?: number | null; hdl?: number | null; tg?: number | null; creatinine?: number | null; creatinineUnit: 'MG_L' | 'UMOL_L' | 'MG_DL'; egfr?: number | null; potassium?: number | null; sodium?: number | null; ntprobnp?: number | null; hba1c?: number | null; troponin?: string | null; notes?: string | null }
export type Scores = { chf: boolean; hypertension: boolean; diabetes: boolean; strokeTia: boolean; vascular: boolean; uncontrolledHtn: boolean; renal: boolean; liver: boolean; bleeding: boolean; labileInr: boolean; drugs: boolean; alcohol: boolean; chadsvasc?: number | null; hasbled?: number | null; notes?: string | null }
export type Plan = { diagnosis?: string | null; anticoagulation: 'NONE' | 'VKA' | 'DOAC' | 'ANTIPLATELET' | 'DUAL_ANTIPLATELET'; inrMin?: number | null; inrMax?: number | null; riskCategory?: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | null; bpTargetSys?: number | null; bpTargetDia?: number | null; treatment?: string | null; nextVisit?: string | null; notes?: string | null }

export const RISK_CATEGORY: Record<NonNullable<Plan['riskCategory']>, string> = { LOW: 'Faible', MODERATE: 'Modéré', HIGH: 'Élevé', VERY_HIGH: 'Très élevé' }
export const ANTICOAG: Record<Plan['anticoagulation'], string> = { NONE: 'Aucun', VKA: 'AVK (antivitamine K)', DOAC: 'AOD (anticoagulant oral direct)', ANTIPLATELET: 'Antiagrégant plaquettaire', DUAL_ANTIPLATELET: 'Double antiagrégation' }

export const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
export const nums = (o: Record<string, string>, keys: string[]) => Object.fromEntries(keys.map(k => [k, num(o[k] ?? '')]))

/**
 * Generic exam: number fields, free texts, an attached tracing or report, then the list of previous exams.
 * Used for echocardiography, Holter, ABPM and stress test.
 */
export function ExamForm<T extends { attachmentId?: string | null }>({ patientId, title, hint, numbers, texts, extra, records, summary, onSave, onDelete, saving, kindLabel }: {
  patientId: string; title: string; hint: string; kindLabel: string
  numbers: [string, string, string?, string?][] // key, label, unit, step
  texts: [string, string, string?][] // key, label, placeholder
  extra?: (values: Record<string, string>, set: (k: string, v: string) => void) => React.ReactNode
  records: ClinicalRecord<T>[]; summary: (data: T) => React.ReactNode
  onSave: (date: string, data: Record<string, any>, done: () => void) => void; onDelete: (id: string) => void; saving: boolean
}) {
  const L = useL()
  const cabinetApi = useCabinetApi()
  const cabinetId = useCabinetId()
  const blank = () => ({ date: today(), ...Object.fromEntries([...numbers.map(n => n[0]), ...texts.map(t => t[0])].map(k => [k, ''])) }) as Record<string, string>
  const [v, setV] = useState(blank)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: string, value: string) => setV(x => ({ ...x, [k]: value }))
  const submit = async () => {
    setBusy(true)
    try {
      const attachmentId = file ? await uploadImage(cabinetApi, patientId, file, `${kindLabel} ${v.date}`) : null
      const data: Record<string, any> = { ...nums(v, numbers.map(n => n[0])), attachmentId }
      for (const [k] of texts) data[k] = v[k] || null
      for (const k of Object.keys(v)) if (!(k in data) && k !== 'date') data[k] = v[k] || null
      onSave(v.date, data, () => { setV(blank()); setFile(null) })
    } catch (err) { toast.error(apiError(err)) } finally { setBusy(false) }
  }
  return (
    <div className="grid gap-5">
      <Section title={L(title)} hint={L(hint)}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void submit() }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field id={`${kindLabel}-date`} label={L('Date')} type="date" value={v.date} onChange={x => set('date', x)} />
            {numbers.map(([k, label, unit, step]) => <Field key={k} id={`${kindLabel}-${k}`} label={L(label)} type="number" step={step || 'any'} unit={unit} value={v[k]} onChange={x => set(k, x)} />)}
          </div>
          {extra?.(v, set)}
          {texts.map(([k, label, ph]) => (
            <div key={k} className="space-y-1.5"><Label htmlFor={`${kindLabel}-${k}`}>{L(label)}</Label><Textarea id={`${kindLabel}-${k}`} rows={2} value={v[k]} placeholder={ph ? L(ph) : undefined} onChange={e => set(k, e.target.value)} /></div>
          ))}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5"><Label htmlFor={`${kindLabel}-file`}>{L('Tracé ou compte rendu de l’appareil (image ou PDF)')}</Label>
              <Input id={`${kindLabel}-file`} type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="cursor-pointer pt-2" />
            </div>
            <Button type="submit" disabled={saving || busy}>{busy ? L('Envoi…') : L('Enregistrer')}</Button>
          </div>
        </form>
      </Section>
      <Section title={L('Examens précédents')}>
        {records.length === 0 ? <Empty>{L('Aucun examen enregistré.')}</Empty> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {records.map(r => (
              <li key={r.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                {r.data.attachmentId ? <div className="w-24"><Thumb patientId={patientId} attachmentId={r.data.attachmentId} onOpen={() => openAttachment(cabinetId!, patientId, r.data.attachmentId!).catch(() => undefined)} /></div> : <span />}
                <div className="grid content-start gap-1"><RecordMeta record={r} onDelete={() => onDelete(r.id)} />{summary(r.data)}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

/** Age in whole years today (or at a given date), null without a birth date. */
export function ageYears(birthDate: string | null | undefined, at = new Date()) {
  if (!birthDate) return null
  const b = new Date(birthDate)
  let age = at.getFullYear() - b.getFullYear()
  if (at.getMonth() < b.getMonth() || (at.getMonth() === b.getMonth() && at.getDate() < b.getDate())) age--
  return age
}

/** Small coloured badge (good / watch / alert). */
export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info'; children: React.ReactNode }) {
  const cls = { ok: 'bg-[#DFF1E6] text-[#1E7A45]', warn: 'bg-[#FBEED6] text-[#99600B]', bad: 'bg-[#FBE3E0] text-[#B8372C]', info: 'bg-[#E3ECF8] text-[#2D5DAA]' }[tone]
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.8rem] font-bold ${cls}`}>{children}</span>
}
