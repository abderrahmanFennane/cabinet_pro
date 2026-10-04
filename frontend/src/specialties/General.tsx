import { useState } from 'react'
import { formatDateFR } from '../lib/utils'
import { Patient } from '../types'
import { Button } from '../components/ui/button'
import { cleanNumbers, today, useRecords } from './records'
import { COLORS, DeleteButton, Empty, Field, Section, toPoints, Trend } from './ui'
import { useL } from '../lib/labels'

type Vitals = { systolic?: number | null; diastolic?: number | null; pulse?: number | null; weight?: number | null; height?: number | null; temperature?: number | null; glucose?: number | null; hba1c?: number | null; spo2?: number | null }
const KEYS = ['systolic', 'diastolic', 'pulse', 'weight', 'height', 'temperature', 'glucose', 'hba1c', 'spo2'] as const
const empty = { date: today(), ...Object.fromEntries(KEYS.map(k => [k, ''])) } as Record<(typeof KEYS)[number] | 'date', string>

/** General medicine: vital signs and chronic disease follow-up (blood pressure, weight, glucose, HbA1c). */
export default function General({ patient }: { patient: Patient }) {
  const L = useL()
  const { ofKind, save, remove, isLoading } = useRecords(patient.id, 'GENERAL')
  const vitals = ofKind<Vitals>('VITALS')
  const [form, setForm] = useState(empty)
  const set = (k: keyof typeof empty) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const last = vitals[0]?.data
  const bmi = last?.weight && last?.height ? Math.round((last.weight / (last.height / 100) ** 2) * 10) / 10 : null
  const pts = (pick: (v: Vitals) => Record<string, any>, has: (v: Vitals) => any) => toPoints(vitals.filter(r => has(r.data)), r => pick(r.data))

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">{L('Chargement…')}</p>

  return (
    <div className="grid gap-5">
      <Section title={L('Constantes')} hint={last ? `${L('Dernières mesures le')} ${formatDateFR(vitals[0].date)}${bmi ? ` · ${L('IMC')} ${bmi}` : ''}` : L('Saisissez les mesures du jour.')}>
        <form className="grid grid-cols-2 gap-3 sm:grid-cols-5" onSubmit={e => {
          e.preventDefault()
          const { date, ...values } = form
          save.mutate({ kind: 'VITALS', date, data: cleanNumbers(values, [...KEYS]) }, { onSuccess: () => setForm({ ...empty, date: today() }) })
        }}>
          <Field id="v-date" label={L('Date')} type="date" value={form.date} onChange={set('date')} />
          <Field id="v-sys" label={L('TA systolique')} type="number" unit="mmHg" value={form.systolic} onChange={set('systolic')} />
          <Field id="v-dia" label={L('TA diastolique')} type="number" unit="mmHg" value={form.diastolic} onChange={set('diastolic')} />
          <Field id="v-pulse" label={L('Pouls')} type="number" unit="bpm" value={form.pulse} onChange={set('pulse')} />
          <Field id="v-temp" label={L('Température')} type="number" unit="°C" value={form.temperature} onChange={set('temperature')} />
          <Field id="v-weight" label={L('Poids')} type="number" unit="kg" value={form.weight} onChange={set('weight')} />
          <Field id="v-height" label={L('Taille')} type="number" unit="cm" value={form.height} onChange={set('height')} />
          <Field id="v-gly" label={L('Glycémie')} type="number" unit="g/L" value={form.glucose} onChange={set('glucose')} />
          <Field id="v-hba1c" label={L('HbA1c')} type="number" unit="%" value={form.hba1c} onChange={set('hba1c')} />
          <Field id="v-spo2" label={L('SpO2')} type="number" unit="%" value={form.spo2} onChange={set('spo2')} />
          <Button type="submit" className="col-span-2 sm:col-span-5" disabled={save.isPending || KEYS.every(k => !form[k])}>{L('Enregistrer les constantes')}</Button>
        </form>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={L('Tension artérielle')}>
          <Trend data={pts(v => ({ sys: v.systolic, dia: v.diastolic ?? null }), v => v.systolic)} unit="mmHg"
            series={[{ key: 'sys', label: L('Systolique'), color: COLORS.red }, { key: 'dia', label: L('Diastolique'), color: COLORS.blue }]} references={[{ y: 140, label: '140' }, { y: 90, label: '90' }]} />
        </Section>
        <Section title={L('Poids')}>
          <Trend data={pts(v => ({ weight: v.weight }), v => v.weight)} unit="kg" series={[{ key: 'weight', label: L('Poids'), color: COLORS.primary }]} />
        </Section>
        <Section title={L('Glycémie à jeun')}>
          <Trend data={pts(v => ({ glucose: v.glucose }), v => v.glucose)} unit="g/L" series={[{ key: 'glucose', label: L('Glycémie'), color: COLORS.amber }]} references={[{ y: 1.26, label: '1,26' }]} />
        </Section>
        <Section title={L('HbA1c (diabète)')}>
          <Trend data={pts(v => ({ hba1c: v.hba1c }), v => v.hba1c)} unit="%" series={[{ key: 'hba1c', label: 'HbA1c', color: COLORS.violet }]} references={[{ y: 7, label: '7 %' }]} />
        </Section>
      </div>

      <Section title={L('Historique')}>
        {vitals.length === 0 ? <Empty>{L('Aucune mesure enregistrée.')}</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[0.88rem]">
              <thead className="text-[0.72rem] uppercase tracking-[0.07em] text-[#5A6B65]">
                <tr><th className="py-2 text-start">{L('Date')}</th><th className="text-end">{L('TA')}</th><th className="text-end">{L('Pouls')}</th><th className="text-end">{L('Poids')}</th><th className="text-end">{L('Glycémie')}</th><th className="text-end">{L('HbA1c')}</th><th className="text-end">{L('T°')}</th><th /></tr>
              </thead>
              <tbody>
                {vitals.map(r => (
                  <tr key={r.id} className="border-t border-[#E3EAE7] tabular-nums">
                    <td className="py-1.5 font-mono">{formatDateFR(r.date)}</td>
                    <td className="text-end">{r.data.systolic ? `${r.data.systolic}/${r.data.diastolic ?? '?'}` : '—'}</td>
                    <td className="text-end">{r.data.pulse ?? '—'}</td>
                    <td className="text-end">{r.data.weight ?? '—'}</td>
                    <td className="text-end">{r.data.glucose ?? '—'}</td>
                    <td className="text-end">{r.data.hba1c ?? '—'}</td>
                    <td className="text-end">{r.data.temperature ?? '—'}</td>
                    <td className="w-10"><DeleteButton onDelete={() => remove.mutate(r.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
