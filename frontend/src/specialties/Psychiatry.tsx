import { useState } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '../lib/utils'
import { Patient } from '../types'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { NativeSelect } from '../components/ui/native-select'
import { Textarea } from '../components/ui/textarea'
import { today, useRecords } from './records'
import { COLORS, Empty, Field, RecordMeta, Section, toPoints, Trend } from './ui'

type Note = { text: string }
type Scale = { scale: 'PHQ9' | 'GAD7'; score: number; notes?: string | null }

// Standard severity bands of the PHQ-9 (depression) and GAD-7 (anxiety) questionnaires.
const SCALES: Record<Scale['scale'], { label: string; max: number; bands: [number, string][] }> = {
  PHQ9: { label: 'PHQ-9 (dépression)', max: 27, bands: [[4, 'Minime'], [9, 'Légère'], [14, 'Modérée'], [19, 'Modérément sévère'], [27, 'Sévère']] },
  GAD7: { label: 'GAD-7 (anxiété)', max: 21, bands: [[4, 'Minime'], [9, 'Légère'], [14, 'Modérée'], [21, 'Sévère']] },
}
const severity = (scale: Scale['scale'], score: number) => SCALES[scale].bands.find(([max]) => score <= max)?.[1] || ''
const tone = (scale: Scale['scale'], score: number) => (score / SCALES[scale].max > 0.55 ? 'bg-[#FBE3E0] text-[#B8372C]' : score / SCALES[scale].max > 0.3 ? 'bg-[#FBEED6] text-[#99600B]' : 'bg-[#DFF1E6] text-[#1E7A45]')

/** Psychiatry / psychology: private session notes (author only) and PHQ-9 / GAD-7 follow-up. */
export default function Psychiatry({ patient }: { patient: Patient }) {
  const { ofKind, save, remove, isLoading } = useRecords(patient.id, 'PSYCHIATRY')
  const notes = ofKind<Note>('PSY_NOTE')
  const scales = ofKind<Scale>('PSY_SCALE')
  const [text, setText] = useState('')
  const [scale, setScale] = useState({ scale: 'PHQ9' as Scale['scale'], score: '', date: today() })

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">Chargement…</p>
  const points = (s: Scale['scale']) => toPoints(scales.filter(r => r.data.scale === s), r => ({ score: r.data.score }))

  return (
    <div className="grid gap-5">
      <Section title="Notes de séance" hint={<span className="flex items-center gap-1.5"><Lock size={14} />Visibles par vous seul : ni vos confrères ni l’assistante ne les voient.</span>}>
        <form className="grid gap-2" onSubmit={e => { e.preventDefault(); save.mutate({ kind: 'PSY_NOTE', data: { text } }, { onSuccess: () => setText('') }) }}>
          <Label htmlFor="psy-note" className="sr-only">Note de séance</Label>
          <Textarea id="psy-note" rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Contenu de la séance, éléments cliniques, axes de travail…" />
          <div><Button type="submit" disabled={!text.trim() || save.isPending}>Enregistrer la note</Button></div>
        </form>
        {notes.length === 0 ? <Empty>Aucune note.</Empty> : (
          <ul className="grid gap-2">
            {notes.map(n => (
              <li key={n.id} className="grid gap-1 rounded-xl border border-[#E3EAE7] p-3 text-[0.92rem]">
                <RecordMeta record={n} onDelete={() => remove.mutate(n.id)} />
                <p className="whitespace-pre-line">{n.data.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Échelles d’évaluation" hint="Score total du questionnaire, interprété selon les seuils habituels.">
        <form className="grid gap-3 sm:grid-cols-[220px_140px_150px_auto] sm:items-end" onSubmit={e => {
          e.preventDefault()
          save.mutate({ kind: 'PSY_SCALE', date: scale.date, data: { scale: scale.scale, score: Number(scale.score) } }, { onSuccess: () => setScale(s => ({ ...s, score: '' })) })
        }}>
          <div className="space-y-1.5"><Label htmlFor="psy-scale">Questionnaire</Label>
            <NativeSelect id="psy-scale" value={scale.scale} onChange={e => setScale(s => ({ ...s, scale: e.target.value as Scale['scale'] }))}>
              {Object.entries(SCALES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </NativeSelect>
          </div>
          <Field id="psy-score" label={`Score (0–${SCALES[scale.scale].max})`} type="number" step="1" value={scale.score} onChange={v => setScale(s => ({ ...s, score: v }))} />
          <Field id="psy-date" label="Date" type="date" value={scale.date} onChange={v => setScale(s => ({ ...s, date: v }))} />
          <Button type="submit" disabled={scale.score === '' || Number(scale.score) > SCALES[scale.scale].max || save.isPending}>
            Ajouter{scale.score !== '' ? ` · ${severity(scale.scale, Number(scale.score))}` : ''}
          </Button>
        </form>
        <div className="grid gap-4 lg:grid-cols-2">
          {(Object.keys(SCALES) as Scale['scale'][]).filter(s => scales.some(r => r.data.scale === s)).map(s => (
            <div key={s}><p className="mb-1 text-[0.86rem] font-semibold">{SCALES[s].label}</p><Trend data={points(s)} height={170} series={[{ key: 'score', label: 'Score', color: s === 'PHQ9' ? COLORS.violet : COLORS.blue }]} /></div>
          ))}
        </div>
        {scales.length > 0 && (
          <ul className="grid gap-1.5 border-t border-[#E3EAE7] pt-3 text-[0.9rem]">
            {scales.map(r => (
              <li key={r.id} className="grid gap-0.5">
                <RecordMeta record={r} onDelete={() => remove.mutate(r.id)} />
                <p>{SCALES[r.data.scale].label} : <b>{r.data.score}</b> <span className={cn('ms-1 rounded-full px-2 py-0.5 text-[0.75rem] font-bold', tone(r.data.scale, r.data.score))}>{severity(r.data.scale, r.data.score)}</span></p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
