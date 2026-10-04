import { useState } from 'react'
import { Check } from 'lucide-react'
import { useL } from '../../lib/labels'
import { cn, formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, today } from '../records'
import { Empty, Field, RecordMeta, Section } from '../ui'
import { milestoneLate, MILESTONES, SCREENINGS } from './calc'
import { ageLabel, Milestone, monthsBetween, Screening } from './shared'

const AREA: Record<(typeof MILESTONES)[number]['area'], string> = { MOTOR: 'Motricité', FINE: 'Motricité fine', LANGUAGE: 'Langage', SOCIAL: 'Relation et communication' }
const RESULT: Record<Screening['result'], [string, string]> = {
  NORMAL: ['Normal', 'bg-[#DFF1E6] text-[#1E7A45]'], TO_CONTROL: ['À contrôler', 'bg-[#FBEED6] text-[#99600B]'], ABNORMAL: ['Anormal, à adresser', 'bg-[#FBE3E0] text-[#B8372C]'],
}
/** M-CHAT-R reading of the total score (0-20). */
const mchat = (s: number) => (s <= 2 ? ['Risque faible', 'NORMAL'] : s <= 7 ? ['Risque moyen : entretien de suivi M-CHAT-R/F', 'TO_CONTROL'] : ['Risque élevé : orienter pour évaluation', 'ABNORMAL']) as [string, Screening['result']]

/** Development milestones (reached / expected / late) and screening tests. */
export default function DevelopmentTab({ patient, milestones, screenings, saving, onSave, onDelete }: {
  patient: Patient; milestones: ClinicalRecord<Milestone>[]; screenings: ClinicalRecord<Screening>[]; saving: boolean
  onSave: (kind: string, date: string | undefined, data: object, done?: () => void) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const birth = patient.birthDate ? new Date(patient.birthDate) : null
  const age = birth ? monthsBetween(birth, new Date()) : null
  const [all, setAll] = useState(false)
  const [s, setS] = useState({ date: today(), test: 'HEARING' as Screening['test'], result: 'NORMAL' as Screening['result'], score: '', notes: '' })
  const reached = new Map(milestones.map(m => [m.data.code, m]))
  const shown = MILESTONES.filter(m => all || age === null || m.typical <= age + 6 || reached.has(m.code))
  const late = age === null ? [] : MILESTONES.filter(m => !reached.has(m.code) && milestoneLate(m, age))
  const lastOf = (test: Screening['test']) => screenings.find(x => x.data.test === test)
  const score = s.test === 'MCHAT' && s.score !== '' ? mchat(Number(s.score)) : null

  return (
    <div className="grid gap-5">
      <Section title={L('Développement psychomoteur')} hint={L('Repères indicatifs (OMS, CDC) : cochez ce que l’enfant fait. Une acquisition absente après l’âge d’alerte mérite un examen attentif.')}
        action={late.length > 0 ? <span className="rounded-full bg-[#FBE3E0] px-2.5 py-1 text-[0.8rem] font-bold text-[#B8372C]">{late.length} {L('à surveiller')}</span> : undefined}>
        {age === null && <Empty>{L('Ajoutez la date de naissance de l’enfant (Modifier) pour situer les acquisitions.')}</Empty>}
        <div className="grid gap-4 lg:grid-cols-2">
          {(Object.keys(AREA) as (keyof typeof AREA)[]).map(area => {
            const items = shown.filter(m => m.area === area)
            if (!items.length) return null
            return (
              <div key={area}>
                <p className="mb-1.5 text-[0.78rem] font-bold uppercase tracking-[0.07em] text-[#5A6B65]">{L(AREA[area])}</p>
                <ul className="grid gap-1.5">
                  {items.map(m => {
                    const rec = reached.get(m.code)
                    const status = rec ? 'done' : age === null ? 'later' : milestoneLate(m, age) ? 'late' : age >= m.alert ? 'unknown' : age >= m.typical ? 'due' : 'later'
                    return (
                      <li key={m.code} className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[0.88rem]',
                        status === 'done' ? 'border-[#DFF1E6] bg-[#F3FAF6]' : status === 'late' ? 'border-[#F6CFCA] bg-[#FDF3F2]' : status === 'due' ? 'border-[#F4DDB0] bg-[#FDF8EE]' : 'border-[#E3EAE7]')}>
                        <span className="min-w-0">
                          <b className="block font-semibold">{L(m.label)}</b>
                          <span className="text-[0.8rem] text-[#5A6B65]">
                            {L('vers')} {ageLabel(m.typical, L)} · {L('alerte après')} {ageLabel(m.alert, L)}
                            {rec ? ` · ${L('acquis à')} ${ageLabel(rec.data.ageMonths ?? 0, L)}` : status === 'late' ? ` · ${L('pas encore acquis')}` : status === 'unknown' ? ` · ${L('non noté')}` : ''}
                          </span>
                        </span>
                        {rec
                          ? <button type="button" className="flex items-center gap-1 text-[0.8rem] font-semibold text-[#1E7A45]" title={L('Annuler')} onClick={() => { if (window.confirm(`${L('Annuler')} « ${L(m.label)} » ?`)) onDelete(rec.id) }}><Check size={15} />{L('Acquis')}</button>
                          : <Button size="sm" variant="outline" disabled={saving} onClick={() => onSave('MILESTONE', today(), { code: m.code, ageMonths: age })}>{L('Acquis')}</Button>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
        {age !== null && <button type="button" className="justify-self-start text-[0.86rem] font-semibold text-primary" onClick={() => setAll(x => !x)}>{all ? L('Afficher seulement les repères de son âge') : L('Afficher tous les repères')}</button>}
      </Section>

      <Section title={L('Dépistages')} hint={L('Audition, vision, hanches, anémie, autisme (M-CHAT-R), dents.')}>
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {SCREENINGS.filter(x => x.test !== 'OTHER').map(x => {
            const last = lastOf(x.test)
            return (
              <li key={x.test} className="rounded-xl border border-[#E3EAE7] px-3 py-2 text-[0.88rem]">
                <b className="block">{L(x.label)}</b>
                <span className="text-[0.8rem] text-[#5A6B65]">{x.when && L(x.when)}</span>
                <p className="mt-1">{last ? <span className={cn('rounded-full px-2 py-0.5 text-[0.78rem] font-bold', RESULT[last.data.result][1])}>{L(RESULT[last.data.result][0])} · {formatDateFR(last.date)}</span>
                  : <span className="text-[0.8rem] text-[#8A9A94]">{age !== null && age >= x.from ? L('Pas encore noté') : L('Plus tard')}</span>}</p>
              </li>
            )
          })}
        </ul>
        <form className="grid gap-3 border-t border-[#E3EAE7] pt-3" onSubmit={e => {
          e.preventDefault()
          onSave('SCREENING', s.date, { test: s.test, result: score ? score[1] : s.result, score: s.score === '' ? null : Number(s.score), notes: s.notes || null }, () => setS(x => ({ ...x, score: '', notes: '' })))
        }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field id="sc-date" label={L('Date')} type="date" value={s.date} onChange={v => setS(x => ({ ...x, date: v }))} />
            <div className="space-y-1.5"><Label htmlFor="sc-test">{L('Dépistage')}</Label>
              <NativeSelect id="sc-test" value={s.test} onChange={e => setS(x => ({ ...x, test: e.target.value as Screening['test'], score: '' }))}>{SCREENINGS.map(x => <option key={x.test} value={x.test}>{L(x.label)}</option>)}</NativeSelect>
            </div>
            {s.test === 'MCHAT'
              ? <Field id="sc-score" label={L('Score M-CHAT-R (0 à 20)')} type="number" step="1" value={s.score} onChange={v => setS(x => ({ ...x, score: v }))} />
              : <div className="space-y-1.5"><Label htmlFor="sc-res">{L('Résultat')}</Label>
                  <NativeSelect id="sc-res" value={s.result} onChange={e => setS(x => ({ ...x, result: e.target.value as Screening['result'] }))}>{Object.entries(RESULT).map(([k, [v]]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
                </div>}
            <Field id="sc-notes" label={L('Remarque')} value={s.notes} onChange={v => setS(x => ({ ...x, notes: v }))} />
          </div>
          {score && <p className={cn('rounded-xl px-3 py-2 text-[0.88rem] font-semibold', RESULT[score[1]][1])}>{L(score[0])}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={saving || (s.test === 'MCHAT' && s.score === '')}>{L('Enregistrer le dépistage')}</Button></div>
        </form>
        {screenings.length > 0 && (
          <ul className="grid gap-2">
            {screenings.map(r => (
              <li key={r.id} className="grid gap-0.5 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                <RecordMeta record={r} onDelete={() => onDelete(r.id)} />
                <p><b>{L(SCREENINGS.find(x => x.test === r.data.test)?.label || '')}</b> · <span className={cn('rounded-full px-2 py-0.5 text-[0.78rem] font-bold', RESULT[r.data.result][1])}>{L(RESULT[r.data.result][0])}</span>{r.data.score != null ? ` · ${L('score')} ${r.data.score}` : ''}</p>
                {r.data.notes && <p className="text-[#5A6B65]">{r.data.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
