import { useState } from 'react'
import { Check } from 'lucide-react'
import { useL } from '../../lib/labels'
import { cn, formatDateFR } from '../../lib/utils'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { ClinicalRecord, today } from '../records'
import { Empty, Section } from '../ui'
import { addDays, checkStatus, gestationalAge, PRENATAL } from './calc'
import { lmpOf, Pregnancy, PrenatalCheck } from './shared'

const STYLE = { done: 'border-[#DFF1E6] bg-[#F3FAF6]', late: 'border-[#F6CFCA] bg-[#FDF3F2]', due: 'border-[#F4DDB0] bg-[#FDF8EE]', later: 'border-[#E3EAE7]' }

/** Prenatal calendar of the current pregnancy: each exam with its window (dates), done / due / late, and its result. */
export default function CalendarTab({ pregnancy, checks, saving, onSave, onDelete }: {
  pregnancy?: ClinicalRecord<Pregnancy>; checks: ClinicalRecord<PrenatalCheck>[]; saving: boolean
  onSave: (kind: string, date: string | undefined, data: object, done?: () => void) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const [results, setResults] = useState<Record<string, string>>({})
  if (!pregnancy) return <Section title={L('Calendrier prénatal')}><Empty>{L('Déclarez d’abord la grossesse (onglet Grossesse).')}</Empty></Section>

  const p = pregnancy.data
  const lmp = lmpOf(p)
  const ongoing = p.status === 'ONGOING'
  // A finished pregnancy is judged at its end, so nothing turns "late" afterwards.
  const end = p.status === 'DELIVERED' && p.deliveryDate ? new Date(p.deliveryDate) : new Date()
  const weeks = gestationalAge(lmp, end).total / 7
  const mine = checks.filter(c => c.data.pregnancyId === pregnancy.id)
  const doneOf = (code: string) => mine.find(c => c.data.code === code)
  const items = [
    ...PRENATAL.filter(c => !c.rhNegOnly || p.rhesus === 'NEG').map(c => ({ ...c, window: `${formatDateFR(addDays(lmp, c.from * 7))} → ${formatDateFR(addDays(lmp, c.to * 7))}`, sa: `${c.from}-${c.to} SA`, status: checkStatus(c, weeks, !!doneOf(c.code)) })),
    ...(p.status === 'DELIVERED' && p.deliveryDate ? [(() => {
      const days = (Date.now() - new Date(p.deliveryDate!).getTime()) / 86_400_000
      const done = !!doneOf('POSTNATAL')
      return { code: 'POSTNATAL', label: 'Visite postnatale', detail: 'col, cicatrice, allaitement, contraception, humeur', window: `${formatDateFR(addDays(p.deliveryDate!, 42))} → ${formatDateFR(addDays(p.deliveryDate!, 56))}`, sa: L('6 à 8 semaines après'), status: (done ? 'done' : days > 56 ? 'late' : days >= 42 ? 'due' : 'later') as keyof typeof STYLE }
    })()] : []),
  ]
  const late = items.filter(i => i.status === 'late').length

  return (
    <Section title={L('Calendrier prénatal')} hint={`${L('Calendrier indicatif, calculé depuis la DDR')}${p.datingLmp ? ` ${L('corrigée')}` : ''} (${formatDateFR(lmp)}). ${L('Adaptez-le à chaque patiente.')}`}
      action={late > 0 && ongoing ? <span className="rounded-full bg-[#FBE3E0] px-2.5 py-1 text-[0.8rem] font-bold text-[#B8372C]">{late} {L('en retard')}</span> : undefined}>
      <ul className="grid gap-2">
        {items.map(i => {
          const rec = doneOf(i.code)
          return (
            <li key={i.code} className={cn('grid gap-2 rounded-xl border px-3 py-2.5 text-[0.9rem] sm:grid-cols-[1fr_auto] sm:items-center', STYLE[i.status])}>
              <span className="min-w-0">
                <b className="block">{L(i.label)}</b>
                <span className="text-[0.8rem] text-[#5A6B65]">
                  {i.sa} · {i.window}{i.detail ? ` · ${L(i.detail)}` : ''}
                  {rec ? ` · ${L('fait le')} ${formatDateFR(rec.date)}` : i.status === 'late' ? ` · ${L('en retard')}` : i.status === 'due' ? ` · ${L('à faire maintenant')}` : ''}
                </span>
                {rec?.data.result && <span className="block text-[0.86rem]">{rec.data.result}</span>}
              </span>
              {rec
                ? <button type="button" className="flex items-center gap-1 justify-self-end text-[0.8rem] font-semibold text-[#1E7A45]" title={L('Annuler')} onClick={() => { if (window.confirm(`${L('Annuler')} « ${L(i.label)} » ?`)) onDelete(rec.id) }}><Check size={15} />{L('Fait')}</button>
                : (
                  <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); onSave('PRENATAL_CHECK', today(), { pregnancyId: pregnancy.id, code: i.code, result: results[i.code] || null }, () => setResults(r => ({ ...r, [i.code]: '' }))) }}>
                    <Input className="h-9 w-full sm:w-56" aria-label={L('Résultat')} placeholder={L('Résultat (facultatif)')} value={results[i.code] || ''} onChange={e => setResults(r => ({ ...r, [i.code]: e.target.value }))} />
                    <Button type="submit" size="sm" variant="outline" disabled={saving}>{L('Fait')}</Button>
                  </form>
                )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
