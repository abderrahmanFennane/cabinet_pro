import { useState } from 'react'
import { useL } from '../../lib/labels'
import { cn } from '../../lib/utils'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, cleanNumbers } from '../records'
import { DeleteButton, Empty, Field, Section } from '../ui'
import { gravidityParity, PAST_OUTCOME, PastPregnancy, Pregnancy } from './shared'

const blank = { year: '', outcome: 'VAGINAL', weeks: '', babyWeight: '', complications: '' }

/** Obstetric history: one line per previous pregnancy; gravidity, parity and cesareans are counted from it. */
export default function HistoryTab({ past, pregnancies, saving, onSave, onDelete }: {
  past: ClinicalRecord<PastPregnancy>[]; pregnancies: ClinicalRecord<Pregnancy>[]; saving: boolean
  onSave: (kind: string, date: string | undefined, data: object, done?: () => void) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const [f, setF] = useState(blank)
  const set = (k: keyof typeof blank) => (v: string) => setF(x => ({ ...x, [k]: v }))
  const ongoing = pregnancies.some(p => p.data.status === 'ONGOING')
  const gp = gravidityParity(past.map(p => p.data), ongoing)
  const sorted = [...past].sort((a, b) => (b.data.year ?? 0) - (a.data.year ?? 0))
  const miscarriages = past.filter(p => p.data.outcome === 'MISCARRIAGE').length

  return (
    <Section title={L('Antécédents obstétricaux')} hint={L('Une ligne par grossesse antérieure. La gestité et la parité sont calculées automatiquement.')}
      action={<div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-[#E3ECF8] px-2.5 py-1 text-[0.8rem] font-bold text-[#2D5DAA]">G{gp.g} P{gp.p}</span>
        {gp.cesareans > 0 && <span className="rounded-full bg-[#FBEED6] px-2.5 py-1 text-[0.8rem] font-bold text-[#99600B]">{L('Utérus cicatriciel')} ({gp.cesareans})</span>}
        {miscarriages >= 3 && <span className="rounded-full bg-[#FBE3E0] px-2.5 py-1 text-[0.8rem] font-bold text-[#B8372C]">{L('Fausses couches à répétition')}</span>}
      </div>}>
      <form className="grid grid-cols-2 gap-3 sm:grid-cols-[100px_1.5fr_100px_120px_2fr_auto] sm:items-end" onSubmit={e => {
        e.preventDefault()
        onSave('OB_PAST', undefined, { ...cleanNumbers({ year: f.year, weeks: f.weeks, babyWeight: f.babyWeight }, ['year', 'weeks', 'babyWeight']), outcome: f.outcome, complications: f.complications || null }, () => setF(blank))
      }}>
        <Field id="op-year" label={L('Année')} type="number" step="1" value={f.year} onChange={set('year')} />
        <div className="space-y-1.5"><Label htmlFor="op-out">{L('Issue')}</Label>
          <NativeSelect id="op-out" value={f.outcome} onChange={e => set('outcome')(e.target.value)}>{Object.entries(PAST_OUTCOME).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
        </div>
        <Field id="op-weeks" label={L('Terme')} unit="SA" type="number" step="1" value={f.weeks} onChange={set('weeks')} />
        <Field id="op-w" label={L('Poids')} unit="kg" type="number" value={f.babyWeight} onChange={set('babyWeight')} />
        <Field id="op-c" label={L('Complications')} value={f.complications} onChange={set('complications')} placeholder={L('ex. prééclampsie, hémorragie de la délivrance')} className="col-span-2 sm:col-span-1" />
        <Button type="submit" className="col-span-2 sm:col-span-1" disabled={saving}>{L('Ajouter')}</Button>
      </form>
      {sorted.length === 0 ? <Empty>{L('Aucun antécédent obstétrical noté.')}</Empty> : (
        <ul className="grid gap-1.5">
          {sorted.map(r => {
            const d = r.data
            const birth = d.outcome === 'VAGINAL' || d.outcome === 'CESAREAN'
            return (
              <li key={r.id} className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[0.9rem]', birth ? 'border-[#E3EAE7]' : 'border-[#F4DDB0] bg-[#FDF8EE]')}>
                <span><b>{d.year ?? '—'}</b> · {L(PAST_OUTCOME[d.outcome])}{d.weeks ? ` · ${d.weeks} SA` : ''}{d.babyWeight ? ` · ${d.babyWeight} kg` : ''}{d.complications ? <span className="text-[#5A6B65]"> · {d.complications}</span> : null}</span>
                <DeleteButton onDelete={() => onDelete(r.id)} />
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
