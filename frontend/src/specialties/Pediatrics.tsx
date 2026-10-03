import { useState } from 'react'
import { Check, Syringe } from 'lucide-react'
import { cn, formatDateFR } from '../lib/utils'
import { Patient } from '../types'
import { Button } from '../components/ui/button'
import { cleanNumbers, today, useRecords } from './records'
import { COLORS, DeleteButton, Empty, Field, Section, Trend } from './ui'

type Growth = { weight?: number | null; height?: number | null; headCircumference?: number | null; notes?: string | null }
type Vaccine = { code: string; lot?: string | null; notes?: string | null }

/**
 * Indicative calendar of the Moroccan national immunisation programme (PNI).
 * Check it against the calendar in force; ages are in months.
 */
export const PNI_CALENDAR: { code: string; label: string; months: number; girlsOnly?: boolean }[] = [
  { code: 'BCG', label: 'BCG', months: 0 },
  { code: 'HB0', label: 'Hépatite B (naissance)', months: 0 },
  { code: 'VPO0', label: 'Polio oral (VPO 0)', months: 0 },
  { code: 'PENTA1', label: 'Pentavalent 1 (DTC-Hib-HB)', months: 2 },
  { code: 'VPO1', label: 'Polio oral 1', months: 2 },
  { code: 'PNEUMO1', label: 'Pneumocoque 1', months: 2 },
  { code: 'ROTA1', label: 'Rotavirus 1', months: 2 },
  { code: 'PENTA2', label: 'Pentavalent 2', months: 3 },
  { code: 'VPO2', label: 'Polio oral 2', months: 3 },
  { code: 'ROTA2', label: 'Rotavirus 2', months: 3 },
  { code: 'PENTA3', label: 'Pentavalent 3', months: 4 },
  { code: 'VPO3', label: 'Polio oral 3', months: 4 },
  { code: 'VPI', label: 'Polio injectable (VPI)', months: 4 },
  { code: 'PNEUMO2', label: 'Pneumocoque 2', months: 4 },
  { code: 'RR1', label: 'Rougeole-Rubéole 1', months: 9 },
  { code: 'PNEUMO3', label: 'Pneumocoque (rappel)', months: 12 },
  { code: 'RR2', label: 'Rougeole-Rubéole 2', months: 18 },
  { code: 'DTC_R1', label: 'DTC rappel 1', months: 18 },
  { code: 'VPO_R1', label: 'Polio oral rappel 1', months: 18 },
  { code: 'DTC_R2', label: 'DTC rappel 2', months: 60 },
  { code: 'VPO_R2', label: 'Polio oral rappel 2', months: 60 },
  { code: 'HPV', label: 'Papillomavirus (HPV)', months: 132, girlsOnly: true },
]

const monthsBetween = (from: Date, to: Date) => (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0)
const ageLabel = (months: number) => (months < 1 ? 'Naissance' : months < 24 ? `${months} mois` : `${Math.floor(months / 12)} ans`)

/** Pediatrics: growth measures with curves by age, and the vaccination calendar. */
export default function Pediatrics({ patient }: { patient: Patient }) {
  const { ofKind, save, remove, isLoading } = useRecords(patient.id, 'PEDIATRICS')
  const growth = ofKind<Growth>('GROWTH')
  const vaccines = ofKind<Vaccine>('VACCINE')
  const [form, setForm] = useState({ date: today(), weight: '', height: '', headCircumference: '' })
  const [lot, setLot] = useState('')
  const birth = patient.birthDate ? new Date(patient.birthDate) : null
  const ageMonths = birth ? monthsBetween(birth, new Date()) : null

  const saveGrowth = () => save.mutate({ kind: 'GROWTH', date: form.date, data: cleanNumbers({ weight: form.weight, height: form.height, headCircumference: form.headCircumference }, ['weight', 'height', 'headCircumference']) }, {
    onSuccess: () => setForm({ date: today(), weight: '', height: '', headCircumference: '' }),
  })
  const markDone = (code: string) => save.mutate({ kind: 'VACCINE', date: today(), data: { code, lot: lot || null } }, { onSuccess: () => setLot('') })

  // Curves by age in months, so the shape matches paediatric growth charts.
  const points = birth ? [...growth].reverse().map(r => {
    const m = monthsBetween(birth, new Date(r.date))
    const bmi = r.data.weight && r.data.height ? Math.round((r.data.weight / (r.data.height / 100) ** 2) * 10) / 10 : null
    return { label: ageLabel(m), weight: r.data.weight ?? null, height: r.data.height ?? null, head: r.data.headCircumference ?? null, bmi }
  }) : []
  const done = new Map(vaccines.map(v => [v.data.code, v]))
  const calendar = PNI_CALENDAR.filter(v => !v.girlsOnly || patient.sex !== 'M')
  const late = ageMonths === null ? [] : calendar.filter(v => !done.has(v.code) && ageMonths > v.months + 1)

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">Chargement…</p>

  return (
    <div className="grid gap-5">
      {!birth && <Empty>Ajoutez la date de naissance de l’enfant (Modifier) pour calculer l’âge des mesures et des vaccins.</Empty>}

      <Section title="Croissance" hint={ageMonths !== null ? `Âge : ${ageLabel(ageMonths)}` : undefined}>
        <form className="grid gap-3 sm:grid-cols-[150px_1fr_1fr_1fr_auto] sm:items-end" onSubmit={e => { e.preventDefault(); saveGrowth() }}>
          <Field id="g-date" label="Date" type="date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
          <Field id="g-weight" label="Poids" type="number" unit="kg" value={form.weight} onChange={v => setForm(f => ({ ...f, weight: v }))} />
          <Field id="g-height" label="Taille" type="number" unit="cm" value={form.height} onChange={v => setForm(f => ({ ...f, height: v }))} />
          <Field id="g-head" label="Périmètre crânien" type="number" unit="cm" value={form.headCircumference} onChange={v => setForm(f => ({ ...f, headCircumference: v }))} />
          <Button type="submit" disabled={save.isPending || (!form.weight && !form.height && !form.headCircumference)}>Ajouter</Button>
        </form>
        <div className="grid gap-4 lg:grid-cols-2">
          <div><p className="mb-1 text-[0.86rem] font-semibold">Poids (kg)</p><Trend data={points} unit="kg" series={[{ key: 'weight', label: 'Poids', color: COLORS.primary }]} /></div>
          <div><p className="mb-1 text-[0.86rem] font-semibold">Taille (cm)</p><Trend data={points} unit="cm" series={[{ key: 'height', label: 'Taille', color: COLORS.blue }]} /></div>
          {points.some(p => p.head) && <div><p className="mb-1 text-[0.86rem] font-semibold">Périmètre crânien (cm)</p><Trend data={points} unit="cm" series={[{ key: 'head', label: 'PC', color: COLORS.violet }]} /></div>}
          {points.some(p => p.bmi) && <div><p className="mb-1 text-[0.86rem] font-semibold">IMC (kg/m²)</p><Trend data={points} unit="kg/m²" series={[{ key: 'bmi', label: 'IMC', color: COLORS.amber }]} /></div>}
        </div>
        {growth.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[0.88rem]">
              <thead className="text-[0.72rem] uppercase tracking-[0.07em] text-[#5A6B65]"><tr><th className="py-2 text-start">Date</th><th className="text-start">Âge</th><th className="text-end">Poids</th><th className="text-end">Taille</th><th className="text-end">PC</th><th /></tr></thead>
              <tbody>
                {growth.map(r => (
                  <tr key={r.id} className="border-t border-[#E3EAE7]">
                    <td className="py-1.5 font-mono">{formatDateFR(r.date)}</td>
                    <td>{birth ? ageLabel(monthsBetween(birth, new Date(r.date))) : '—'}</td>
                    <td className="text-end tabular-nums">{r.data.weight ?? '—'}</td>
                    <td className="text-end tabular-nums">{r.data.height ?? '—'}</td>
                    <td className="text-end tabular-nums">{r.data.headCircumference ?? '—'}</td>
                    <td className="w-10"><DeleteButton onDelete={() => remove.mutate(r.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Vaccins" hint="Calendrier indicatif du Programme national d’immunisation (PNI). Vérifiez-le avec le calendrier en vigueur."
        action={late.length > 0 ? <span className="rounded-full bg-[#FBE3E0] px-2.5 py-1 text-[0.8rem] font-bold text-[#B8372C]">{late.length} en retard</span> : undefined}>
        <div className="max-w-xs"><Field id="v-lot" label="N° de lot (pour le prochain vaccin noté)" value={lot} onChange={setLot} /></div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {calendar.map(v => {
            const record = done.get(v.code)
            const dueDate = birth ? new Date(birth.getFullYear(), birth.getMonth() + v.months, birth.getDate()) : null
            const status = record ? 'done' : ageMonths === null ? 'unknown' : ageMonths > v.months + 1 ? 'late' : ageMonths >= v.months ? 'due' : 'later'
            return (
              <li key={v.code} className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[0.88rem]',
                status === 'done' ? 'border-[#DFF1E6] bg-[#F3FAF6]' : status === 'late' ? 'border-[#F6CFCA] bg-[#FDF3F2]' : status === 'due' ? 'border-[#F4DDB0] bg-[#FDF8EE]' : 'border-[#E3EAE7]')}>
                <span className="min-w-0">
                  <b className="block truncate font-semibold">{v.label}</b>
                  <span className="text-[0.8rem] text-[#5A6B65]">
                    {ageLabel(v.months)}{dueDate && !record ? ` · prévu le ${formatDateFR(dueDate)}` : ''}
                    {record ? ` · fait le ${formatDateFR(record.date)}${record.data.lot ? ` (lot ${record.data.lot})` : ''}` : status === 'late' ? ' · en retard' : status === 'due' ? ' · à faire' : ''}
                  </span>
                </span>
                {record
                  ? <button type="button" className="flex items-center gap-1 text-[0.8rem] font-semibold text-[#1E7A45]" title="Annuler" onClick={() => { if (window.confirm(`Annuler « ${v.label} » ?`)) remove.mutate(record.id) }}><Check size={15} />Fait</button>
                  : <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => markDone(v.code)}><Syringe size={14} className="me-1" />Fait aujourd’hui</Button>}
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}
