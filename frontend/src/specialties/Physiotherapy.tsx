import { useState } from 'react'
import { cn, formatDateFR } from '../lib/utils'
import { Patient } from '../types'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { ClinicalRecord, today, useRecords } from './records'
import { COLORS, Empty, Field, RecordMeta, Section, Trend } from './ui'
import { useL } from '../lib/labels'

type Program = { indication: string; sessionsPrescribed: number; prescriber?: string | null; goals?: string | null; status: 'ONGOING' | 'DONE' | 'STOPPED' }
type Session = { programId: string; pain?: number | null; exercises?: string | null; notes?: string | null }

const painTone = (p: number) => (p >= 7 ? 'text-[#B8372C]' : p >= 4 ? 'text-[#99600B]' : 'text-[#1E7A45]')

function ProgramCard({ program, sessions, save, remove }: { program: ClinicalRecord<Program>; sessions: ClinicalRecord<Session>[]; save: ReturnType<typeof useRecords>['save']; remove: ReturnType<typeof useRecords>['remove'] }) {
  const L = useL()
  const p = program.data
  const done = sessions.length
  const ongoing = p.status === 'ONGOING'
  const [form, setForm] = useState({ date: today(), pain: '5', exercises: '', notes: '' })
  const pain = [...sessions].reverse().map((s, i) => ({ label: `S${i + 1}`, pain: s.data.pain ?? null }))

  return (
    <div className="grid gap-4 rounded-xl border border-[#D8E1DD] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[1.1rem] font-extrabold">{p.indication}</p>
          <p className="text-[0.88rem] text-[#5A6B65]">Depuis le {formatDateFR(program.date)}{p.prescriber ? ` · prescrit par ${p.prescriber}` : ''}{!ongoing ? ` · ${p.status === 'DONE' ? 'terminé' : 'arrêté'}` : ''}</p>
          {p.goals && <p className="mt-1 text-[0.9rem]">Objectifs : {p.goals}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ongoing && <Button size="sm" variant="outline" onClick={() => save.mutate({ id: program.id, kind: 'PHYSIO_PROGRAM', data: { ...p, status: 'DONE' } })}>{L('Terminer')}</Button>}
          {!ongoing && <Button size="sm" variant="outline" onClick={() => save.mutate({ id: program.id, kind: 'PHYSIO_PROGRAM', data: { ...p, status: 'ONGOING' } })}>{L('Reprendre')}</Button>}
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex justify-between text-[0.9rem]"><span>{L('Séances réalisées')}</span><span className="font-mono font-semibold tabular-nums">{done} / {p.sessionsPrescribed}</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#E9EFEC]"><i className={cn('block h-full rounded-full', done >= p.sessionsPrescribed ? 'bg-[#99600B]' : 'bg-primary')} style={{ width: `${Math.min(100, (done / p.sessionsPrescribed) * 100)}%` }} /></div>
        {done >= p.sessionsPrescribed && ongoing && <p className="text-[0.85rem] font-semibold text-[#99600B]">{L('Toutes les séances prescrites sont faites : renouvellement de l’ordonnance ou fin du programme.')}</p>}
      </div>

      {ongoing && (
        <form className="grid gap-3 rounded-xl bg-[#F2F5F3] p-3 sm:grid-cols-[150px_1fr]" onSubmit={e => {
          e.preventDefault()
          save.mutate({ kind: 'PHYSIO_SESSION', date: form.date, data: { programId: program.id, pain: Number(form.pain), exercises: form.exercises || null, notes: form.notes || null } }, {
            onSuccess: () => setForm({ date: today(), pain: form.pain, exercises: '', notes: '' }),
          })
        }}>
          <Field id={`ps-date-${program.id}`} label={L('Date')} type="date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
          <div className="space-y-1.5">
            <Label htmlFor={`ps-pain-${program.id}`}>{L('Douleur (EVA) :')} <b className={painTone(Number(form.pain))}>{form.pain} / 10</b></Label>
            <input id={`ps-pain-${program.id}`} type="range" min={0} max={10} step={1} value={form.pain} onChange={e => setForm(f => ({ ...f, pain: e.target.value }))} className="w-full accent-[#12705A]" />
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`ps-ex-${program.id}`}>{L('Exercices et techniques')}</Label><Textarea id={`ps-ex-${program.id}`} rows={2} value={form.exercises} onChange={e => setForm(f => ({ ...f, exercises: e.target.value }))} /></div>
          <Field id={`ps-n-${program.id}`} label={L('Observations')} className="sm:col-span-2" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
          <Button type="submit" className="sm:col-span-2" disabled={save.isPending}>Enregistrer la séance {done + 1}</Button>
        </form>
      )}

      {pain.length >= 2 && <div><p className="mb-1 text-[0.86rem] font-semibold">{L('Évolution de la douleur (EVA)')}</p><Trend data={pain} height={170} series={[{ key: 'pain', label: 'EVA', color: COLORS.red }]} /></div>}

      {sessions.length > 0 && (
        <ul className="grid gap-2">
          {sessions.map((s, i) => (
            <li key={s.id} className="grid gap-0.5 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
              <RecordMeta record={s} onDelete={() => remove.mutate(s.id)} />
              <p><b>Séance {sessions.length - i}</b>{s.data.pain !== null && s.data.pain !== undefined && <> {L('· EVA')} <b className={painTone(s.data.pain)}>{s.data.pain}/10</b></>}</p>
              {s.data.exercises && <p>{s.data.exercises}</p>}
              {s.data.notes && <p className="text-[#5A6B65]">{s.data.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Physiotherapy: prescribed programme, sessions done vs prescribed, pain (EVA) evolution. */
export default function Physiotherapy({ patient }: { patient: Patient }) {
  const L = useL()
  const records = useRecords(patient.id, 'PHYSIOTHERAPY')
  const { ofKind, save, isLoading } = records
  const programs = ofKind<Program>('PHYSIO_PROGRAM')
  const sessions = ofKind<Session>('PHYSIO_SESSION')
  const [form, setForm] = useState({ indication: '', sessionsPrescribed: '10', prescriber: '', goals: '' })

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">{L('Chargement…')}</p>

  return (
    <div className="grid gap-5">
      <Section title={L('Nouveau programme de rééducation')} hint={L('Selon l’ordonnance : indication et nombre de séances prescrites.')}>
        <form className="grid gap-3 sm:grid-cols-[1fr_140px_1fr]" onSubmit={e => {
          e.preventDefault()
          save.mutate({ kind: 'PHYSIO_PROGRAM', data: { indication: form.indication, sessionsPrescribed: Number(form.sessionsPrescribed), prescriber: form.prescriber || null, goals: form.goals || null, status: 'ONGOING' } }, {
            onSuccess: () => setForm({ indication: '', sessionsPrescribed: '10', prescriber: '', goals: '' }),
          })
        }}>
          <Field id="pp-ind" label={L('Indication')} value={form.indication} onChange={v => setForm(f => ({ ...f, indication: v }))} placeholder={L('ex. Lombalgie, rééducation du genou…')} />
          <Field id="pp-n" label={L('Séances prescrites')} type="number" step="1" value={form.sessionsPrescribed} onChange={v => setForm(f => ({ ...f, sessionsPrescribed: v }))} />
          <Field id="pp-pr" label={L('Médecin prescripteur')} value={form.prescriber} onChange={v => setForm(f => ({ ...f, prescriber: v }))} />
          <Field id="pp-goals" label={L('Objectifs')} className="sm:col-span-3" value={form.goals} onChange={v => setForm(f => ({ ...f, goals: v }))} />
          <Button type="submit" className="sm:col-span-3" disabled={!form.indication || !Number(form.sessionsPrescribed) || save.isPending}>{L('Créer le programme')}</Button>
        </form>
      </Section>
      <Section title={L('Programmes')}>
        {programs.length === 0 ? <Empty>{L('Aucun programme de rééducation.')}</Empty> : programs.map(p => (
          <ProgramCard key={p.id} program={p} sessions={sessions.filter(s => s.data.programId === p.id)} save={save} remove={records.remove} />
        ))}
      </Section>
    </div>
  )
}
