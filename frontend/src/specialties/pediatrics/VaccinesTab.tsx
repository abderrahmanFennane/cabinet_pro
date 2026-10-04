import { useState } from 'react'
import { Check, Syringe } from 'lucide-react'
import { useL } from '../../lib/labels'
import { cn, formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { ClinicalRecord, today } from '../records'
import { Field, Section } from '../ui'
import { ageLabel, monthsBetween, PNI_CALENDAR, Vaccine } from './shared'

/** Vaccination calendar of the PNI: done (with lot), due, late. */
export default function VaccinesTab({ patient, vaccines, saving, onSave, onDelete }: {
  patient: Patient; vaccines: ClinicalRecord<Vaccine>[]; saving: boolean
  onSave: (kind: string, date: string | undefined, data: object, done?: () => void) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const [lot, setLot] = useState('')
  const birth = patient.birthDate ? new Date(patient.birthDate) : null
  const ageMonths = birth ? monthsBetween(birth, new Date()) : null
  const done = new Map(vaccines.map(v => [v.data.code, v]))
  const calendar = PNI_CALENDAR.filter(v => !v.girlsOnly || patient.sex !== 'M')
  const late = ageMonths === null ? [] : calendar.filter(v => !done.has(v.code) && ageMonths > v.months + 1)

  return (
    <Section title={L('Vaccins')} hint={L('Calendrier indicatif du Programme national d’immunisation (PNI). Vérifiez-le avec le calendrier en vigueur.')}
      action={late.length > 0 ? <span className="rounded-full bg-[#FBE3E0] px-2.5 py-1 text-[0.8rem] font-bold text-[#B8372C]">{late.length} {L('en retard')}</span> : undefined}>
      <div className="max-w-xs"><Field id="v-lot" label={L('N° de lot (pour le prochain vaccin noté)')} value={lot} onChange={setLot} /></div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {calendar.map(v => {
          const record = done.get(v.code)
          const dueDate = birth ? new Date(birth.getFullYear(), birth.getMonth() + v.months, birth.getDate()) : null
          const status = record ? 'done' : ageMonths === null ? 'unknown' : ageMonths > v.months + 1 ? 'late' : ageMonths >= v.months ? 'due' : 'later'
          return (
            <li key={v.code} className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[0.88rem]',
              status === 'done' ? 'border-[#DFF1E6] bg-[#F3FAF6]' : status === 'late' ? 'border-[#F6CFCA] bg-[#FDF3F2]' : status === 'due' ? 'border-[#F4DDB0] bg-[#FDF8EE]' : 'border-[#E3EAE7]')}>
              <span className="min-w-0">
                <b className="block truncate font-semibold">{L(v.label)}</b>
                <span className="text-[0.8rem] text-[#5A6B65]">
                  {ageLabel(v.months, L)}{dueDate && !record ? ` · ${L('prévu le')} ${formatDateFR(dueDate)}` : ''}
                  {record ? ` · ${L('fait le')} ${formatDateFR(record.date)}${record.data.lot ? ` (${L('lot')} ${record.data.lot})` : ''}` : status === 'late' ? ` · ${L('en retard')}` : status === 'due' ? ` · ${L('à faire')}` : ''}
                </span>
              </span>
              {record
                ? <button type="button" className="flex items-center gap-1 text-[0.8rem] font-semibold text-[#1E7A45]" title={L('Annuler')} onClick={() => { if (window.confirm(`${L('Annuler')} « ${L(v.label)} » ?`)) onDelete(record.id) }}><Check size={15} />{L('Fait')}</button>
                : <Button size="sm" variant="outline" disabled={saving} onClick={() => onSave('VACCINE', today(), { code: v.code, lot: lot || null }, () => setLot(''))}><Syringe size={14} className="me-1" />{L('Fait aujourd’hui')}</Button>}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
