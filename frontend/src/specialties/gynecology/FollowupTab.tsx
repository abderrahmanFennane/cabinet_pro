import { useState } from 'react'
import { useL } from '../../lib/labels'
import { formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord } from '../records'
import { Field, RecordMeta, Section } from '../ui'
import { Followup } from './shared'

const YEAR = 365.25 * 86_400_000
const blank = { contraception: '', lastSmear: '', cycle: '', notes: '', lastHpv: '', hpvResult: '', lastMammogram: '' }
/** Latest value of a field across the follow-up records (each record keeps only what was filled that day). */
const latest = <K extends keyof Followup>(records: ClinicalRecord<Followup>[], k: K) => records.find(r => r.data[k])?.data[k] ?? null

/** Gynecological follow-up: contraception, cycle, cervical screening (smear, HPV test) and mammography, with reminders. */
export default function FollowupTab({ patient, followups, saving, onSave, onDelete }: {
  patient: Patient; followups: ClinicalRecord<Followup>[]; saving: boolean
  onSave: (kind: string, date: string | undefined, data: object, done?: () => void) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const [fu, setFu] = useState(blank)
  const set = (k: keyof typeof blank) => (v: string) => setFu(x => ({ ...x, [k]: v }))
  const age = patient.age ?? null
  const since = (d: string | null) => (d ? (Date.now() - new Date(d).getTime()) / YEAR : null)
  const smear = latest(followups, 'lastSmear') as string | null
  const hpv = latest(followups, 'lastHpv') as string | null
  const mammo = latest(followups, 'lastMammogram') as string | null
  // Usual intervals: smear every 3 years (25-29), HPV test every 5 years (30-65) when negative, mammography every 2 years from 40.
  const reminders = [
    age !== null && age >= 25 && age <= 65 && (() => {
      const s = since(smear), h = since(hpv)
      if (h !== null) return h > 5 ? L('Test HPV de plus de 5 ans') : null
      if (s === null) return L('Aucun dépistage du col noté')
      return s > 3 ? L('Frottis de plus de 3 ans') : null
    })(),
    age !== null && age >= 40 && (() => { const m = since(mammo); return m === null ? L('Aucune mammographie notée') : m > 2 ? L('Mammographie de plus de 2 ans') : null })(),
  ].filter(Boolean) as string[]

  return (
    <Section title={L('Suivi gynécologique')} hint={L('Contraception, cycle, dépistage du cancer du col (frottis, test HPV) et du sein (mammographie).')}
      action={reminders.length ? <div className="flex flex-wrap gap-1.5">{reminders.map(r => <span key={r} className="rounded-full bg-[#FBEED6] px-2.5 py-1 text-[0.8rem] font-bold text-[#99600B]">{r}</span>)}</div> : undefined}>
      <div className="grid gap-1 rounded-xl bg-[#F4F7F6] px-3 py-2.5 text-[0.9rem] sm:grid-cols-3">
        <p><span className="text-[#5A6B65]">{L('Dernier frottis')} : </span><b>{smear ? formatDateFR(smear) : '—'}</b></p>
        <p><span className="text-[#5A6B65]">{L('Dernier test HPV')} : </span><b>{hpv ? `${formatDateFR(hpv)}${latest(followups, 'hpvResult') ? ` (${latest(followups, 'hpvResult') === 'POSITIVE' ? L('positif') : L('négatif')})` : ''}` : '—'}</b></p>
        <p><span className="text-[#5A6B65]">{L('Dernière mammographie')} : </span><b>{mammo ? formatDateFR(mammo) : '—'}</b></p>
      </div>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={e => {
        e.preventDefault()
        onSave('GYN_FOLLOWUP', undefined, Object.fromEntries(Object.entries(fu).map(([k, v]) => [k, v || null])), () => setFu(blank))
      }}>
        <Field id="fu-c" label={L('Contraception')} value={fu.contraception} onChange={set('contraception')} placeholder={(latest(followups, 'contraception') as string) || L('ex. DIU cuivre, pilule…')} />
        <Field id="fu-cy" label={L('Cycle')} value={fu.cycle} onChange={set('cycle')} placeholder={(latest(followups, 'cycle') as string) || L('ex. régulier, 28 j')} />
        <Field id="fu-s" label={L('Dernier frottis')} type="date" value={fu.lastSmear} onChange={set('lastSmear')} />
        <Field id="fu-h" label={L('Dernier test HPV')} type="date" value={fu.lastHpv} onChange={set('lastHpv')} />
        <div className="space-y-1.5"><Label htmlFor="fu-hr">{L('Résultat HPV')}</Label>
          <NativeSelect id="fu-hr" value={fu.hpvResult} onChange={e => set('hpvResult')(e.target.value)}><option value="">—</option><option value="NEGATIVE">{L('Négatif')}</option><option value="POSITIVE">{L('Positif')}</option></NativeSelect>
        </div>
        <Field id="fu-m" label={L('Dernière mammographie')} type="date" value={fu.lastMammogram} onChange={set('lastMammogram')} />
        <Field id="fu-n" label={L('Notes')} value={fu.notes} onChange={set('notes')} className="sm:col-span-2 lg:col-span-3" />
        <Button type="submit" className="sm:col-span-2 lg:col-span-3" disabled={saving || Object.values(fu).every(v => !v)}>{L('Enregistrer')}</Button>
      </form>
      {followups.length > 0 && (
        <ul className="grid gap-2 border-t border-[#E3EAE7] pt-3">
          {followups.map(r => (
            <li key={r.id} className="grid gap-0.5 text-[0.9rem]">
              <RecordMeta record={r} onDelete={() => onDelete(r.id)} />
              <p>{[r.data.contraception && `${L('Contraception')} : ${r.data.contraception}`, r.data.lastSmear && `${L('Frottis')} : ${formatDateFR(r.data.lastSmear)}`, r.data.lastHpv && `HPV : ${formatDateFR(r.data.lastHpv)}${r.data.hpvResult ? ` (${r.data.hpvResult === 'POSITIVE' ? L('positif') : L('négatif')})` : ''}`, r.data.lastMammogram && `${L('Mammographie')} : ${formatDateFR(r.data.lastMammogram)}`, r.data.cycle && `${L('Cycle')} : ${r.data.cycle}`].filter(Boolean).join(' · ')}</p>
              {r.data.notes && <p className="text-[#5A6B65]">{r.data.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
