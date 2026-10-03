import { useEffect, useState } from 'react'
import { cn, formatDateFR } from '../lib/utils'
import { Patient } from '../types'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { cleanNumbers, today, useRecords } from './records'
import { COLORS, DeleteButton, Empty, Field, RecordMeta, Section, toPoints, Trend } from './ui'

type Risk = Record<'hypertension' | 'diabetes' | 'smoking' | 'dyslipidemia' | 'obesity' | 'familyHistory' | 'sedentary', boolean> & { notes?: string | null }
type Reading = { systolic?: number | null; diastolic?: number | null; heartRate?: number | null; inr?: number | null; notes?: string | null }
type Ecg = { rhythm?: string | null; rate?: number | null; interpretation?: string | null }

const RISKS: [keyof Omit<Risk, 'notes'>, string][] = [
  ['hypertension', 'Hypertension artérielle'], ['diabetes', 'Diabète'], ['smoking', 'Tabac'], ['dyslipidemia', 'Dyslipidémie'],
  ['obesity', 'Obésité'], ['familyHistory', 'Antécédents familiaux'], ['sedentary', 'Sédentarité'],
]
const noRisk = Object.fromEntries(RISKS.map(([k]) => [k, false])) as Omit<Risk, 'notes'>

/** Cardiology: cardiovascular risk factors, blood pressure / heart rate / INR follow-up, ECG reports. */
export default function Cardiology({ patient }: { patient: Patient }) {
  const { ofKind, save, remove, isLoading } = useRecords(patient.id, 'CARDIOLOGY')
  const risks = ofKind<Risk>('CARDIO_RISK')
  const readings = ofKind<Reading>('CARDIO_READING')
  const ecgs = ofKind<Ecg>('ECG')
  const [risk, setRisk] = useState(noRisk)
  const [reading, setReading] = useState({ date: today(), systolic: '', diastolic: '', heartRate: '', inr: '' })
  const [ecg, setEcg] = useState({ date: today(), rhythm: '', rate: '', interpretation: '' })

  // Start from the latest assessment, so updating it is one or two clicks.
  useEffect(() => { if (risks[0]) setRisk({ ...noRisk, ...risks[0].data }) }, [risks[0]?.id])
  const count = RISKS.filter(([k]) => risk[k]).length
  const bp = toPoints(readings.filter(r => r.data.systolic), r => ({ sys: r.data.systolic, dia: r.data.diastolic ?? null, hr: r.data.heartRate ?? null }))
  const inr = toPoints(readings.filter(r => r.data.inr), r => ({ inr: r.data.inr }))

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">Chargement…</p>

  return (
    <div className="grid gap-5">
      <Section title="Facteurs de risque cardiovasculaire" hint={risks[0] ? `Dernière évaluation le ${formatDateFR(risks[0].date)}` : 'Cochez les facteurs présents puis enregistrez.'}
        action={<span className={cn('rounded-full px-2.5 py-1 text-[0.8rem] font-bold', count >= 3 ? 'bg-[#FBE3E0] text-[#B8372C]' : count > 0 ? 'bg-[#FBEED6] text-[#99600B]' : 'bg-[#DFF1E6] text-[#1E7A45]')}>{count} facteur{count > 1 ? 's' : ''}</span>}>
        <div className="flex flex-wrap gap-2">
          {RISKS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={risk[k]} onClick={() => setRisk(r => ({ ...r, [k]: !r[k] }))}
              className={cn('rounded-full border px-3.5 py-2 text-[0.88rem] font-semibold', risk[k] ? 'border-[#B8372C] bg-[#FBE3E0] text-[#B8372C]' : 'border-[#D8E1DD] bg-white text-[#5A6B65] hover:bg-[#E9EFEC]')}>
              {risk[k] ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>
        <div><Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ kind: 'CARDIO_RISK', data: risk })}>Enregistrer l’évaluation</Button></div>
      </Section>

      <Section title="Tension, fréquence cardiaque et INR">
        <form className="grid gap-3 sm:grid-cols-[150px_1fr_1fr_1fr_1fr_auto] sm:items-end" onSubmit={e => {
          e.preventDefault()
          save.mutate({ kind: 'CARDIO_READING', date: reading.date, data: cleanNumbers({ systolic: reading.systolic, diastolic: reading.diastolic, heartRate: reading.heartRate, inr: reading.inr }, ['systolic', 'diastolic', 'heartRate', 'inr']) }, {
            onSuccess: () => setReading({ date: today(), systolic: '', diastolic: '', heartRate: '', inr: '' }),
          })
        }}>
          <Field id="cr-date" label="Date" type="date" value={reading.date} onChange={v => setReading(r => ({ ...r, date: v }))} />
          <Field id="cr-sys" label="Systolique" type="number" unit="mmHg" value={reading.systolic} onChange={v => setReading(r => ({ ...r, systolic: v }))} />
          <Field id="cr-dia" label="Diastolique" type="number" unit="mmHg" value={reading.diastolic} onChange={v => setReading(r => ({ ...r, diastolic: v }))} />
          <Field id="cr-hr" label="Fréquence" type="number" unit="bpm" value={reading.heartRate} onChange={v => setReading(r => ({ ...r, heartRate: v }))} />
          <Field id="cr-inr" label="INR" type="number" step="0.1" value={reading.inr} onChange={v => setReading(r => ({ ...r, inr: v }))} />
          <Button type="submit" disabled={save.isPending || (!reading.systolic && !reading.heartRate && !reading.inr)}>Ajouter</Button>
        </form>
        <div className="grid gap-4 lg:grid-cols-2">
          <div><p className="mb-1 text-[0.86rem] font-semibold">Tension (mmHg) et fréquence</p>
            <Trend data={bp} series={[{ key: 'sys', label: 'Systolique', color: COLORS.red }, { key: 'dia', label: 'Diastolique', color: COLORS.blue }, { key: 'hr', label: 'Fréquence', color: COLORS.amber }]} references={[{ y: 140, label: '140' }, { y: 90, label: '90' }]} />
          </div>
          <div><p className="mb-1 text-[0.86rem] font-semibold">INR (cible habituelle sous AVK : 2 à 3)</p>
            <Trend data={inr} series={[{ key: 'inr', label: 'INR', color: COLORS.violet }]} references={[{ y: 2, label: '2' }, { y: 3, label: '3' }]} />
          </div>
        </div>
        {readings.length > 0 && (
          <ul className="grid gap-1 border-t border-[#E3EAE7] pt-3 text-[0.9rem]">
            {readings.slice(0, 8).map(r => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span><span className="font-mono text-[#5A6B65]">{formatDateFR(r.date)}</span>{[r.data.systolic && ` · TA ${r.data.systolic}/${r.data.diastolic ?? '?'}`, r.data.heartRate && ` · ${r.data.heartRate} bpm`, r.data.inr && ` · INR ${r.data.inr}`].filter(Boolean).join('')}</span>
                <DeleteButton onDelete={() => remove.mutate(r.id)} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="ECG" hint="Joignez le tracé dans l’onglet Documents, et notez ici l’interprétation.">
        <form className="grid gap-3 sm:grid-cols-[150px_1fr_140px]" onSubmit={e => {
          e.preventDefault()
          save.mutate({ kind: 'ECG', date: ecg.date, data: { rhythm: ecg.rhythm || null, rate: ecg.rate ? Number(ecg.rate) : null, interpretation: ecg.interpretation || null } }, { onSuccess: () => setEcg({ date: today(), rhythm: '', rate: '', interpretation: '' }) })
        }}>
          <Field id="ecg-date" label="Date" type="date" value={ecg.date} onChange={v => setEcg(x => ({ ...x, date: v }))} />
          <Field id="ecg-rhythm" label="Rythme" value={ecg.rhythm} onChange={v => setEcg(x => ({ ...x, rhythm: v }))} placeholder="ex. Sinusal, FA…" />
          <Field id="ecg-rate" label="Fréquence" type="number" unit="bpm" value={ecg.rate} onChange={v => setEcg(x => ({ ...x, rate: v }))} />
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="ecg-int">Interprétation</Label><Textarea id="ecg-int" rows={2} value={ecg.interpretation} onChange={e => setEcg(x => ({ ...x, interpretation: e.target.value }))} /></div>
          <Button type="submit" className="sm:col-span-3" disabled={save.isPending || (!ecg.rhythm && !ecg.interpretation)}>Enregistrer l’ECG</Button>
        </form>
        {ecgs.length === 0 ? <Empty>Aucun ECG enregistré.</Empty> : (
          <ul className="grid gap-2">
            {ecgs.map(r => (
              <li key={r.id} className="grid gap-0.5 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                <RecordMeta record={r} onDelete={() => remove.mutate(r.id)} />
                <p><b>{r.data.rhythm || 'Rythme non précisé'}</b>{r.data.rate ? ` · ${r.data.rate} bpm` : ''}</p>
                {r.data.interpretation && <p className="text-[#5A6B65]">{r.data.interpretation}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
