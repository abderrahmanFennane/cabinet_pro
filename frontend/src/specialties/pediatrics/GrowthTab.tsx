import { useEffect, useState } from 'react'
import { TrendingDown } from 'lucide-react'
import { useL } from '../../lib/labels'
import { formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, cleanNumbers, today } from '../records'
import { COLORS, DeleteButton, Field, Section, Trend } from '../ui'
import { ageInMonths, Indicator, percentileLabel, Sex } from '../growth'
import { correctedMonths, growthDrop } from './calc'
import { ageLabel, Birth, Growth, Measure, monthsBetween, PercentileChart, Point } from './shared'

const DELIVERY: Record<NonNullable<Birth['delivery']>, string> = { VAGINAL: 'Voie basse', CESAREAN: 'Césarienne', INSTRUMENTAL: 'Voie basse instrumentale' }
const FEEDING: Record<NonNullable<Birth['feeding']>, string> = { BREAST: 'Allaitement maternel', FORMULA: 'Lait infantile', MIXED: 'Allaitement mixte', DIVERSIFIED: 'Alimentation diversifiée' }
const BIRTH_NUMBERS = ['gestationalWeeks', 'gestationalDays', 'birthWeight', 'birthLength', 'birthHead', 'apgar1', 'apgar5']
const emptyBirth = { gestationalWeeks: '', gestationalDays: '', birthWeight: '', birthLength: '', birthHead: '', apgar1: '', apgar5: '', delivery: '', feeding: '', neonatal: '', allergies: '' }
const INDICATOR_LABEL: Record<Indicator, string> = { weight: 'Le poids', height: 'La taille', head: 'Le périmètre crânien', bmi: 'L’IMC' }

/** Birth history, growth measures on the WHO curves (corrected age for premature babies) and curve-drop alerts. */
export default function GrowthTab({ patient, growth, births, saving, onSave, onDelete }: {
  patient: Patient; growth: ClinicalRecord<Growth>[]; births: ClinicalRecord<Birth>[]; saving: boolean
  onSave: (kind: string, date: string | undefined, data: object, done?: () => void, id?: string) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const birthRec = births[0]
  const [b, setB] = useState(emptyBirth)
  const [form, setForm] = useState({ date: today(), weight: '', height: '', headCircumference: '' })
  useEffect(() => setB({ ...emptyBirth, ...Object.fromEntries(Object.entries(birthRec?.data || {}).map(([k, v]) => [k, v == null ? '' : String(v)])) }), [birthRec?.id])
  const setBirth = (k: keyof typeof emptyBirth) => (v: string) => setB(x => ({ ...x, [k]: v }))

  const birth = patient.birthDate ? new Date(patient.birthDate) : null
  const sex: Sex | null = patient.sex === 'M' || patient.sex === 'F' ? patient.sex : null
  const ga = birthRec?.data.gestationalWeeks
  const premature = ga != null && ga < 37
  const ageNow = birth ? ageInMonths(birth, new Date()) : null
  const corrected = ageNow !== null ? correctedMonths(ageNow, ga, birthRec?.data.gestationalDays) : null
  // Age used on the curves: corrected for premature babies until 2 years.
  const curveAge = (at: Date) => { const chrono = ageInMonths(birth!, at); return correctedMonths(chrono, ga, birthRec?.data.gestationalDays) ?? chrono }

  const bmiOf = (w?: number | null, h?: number | null) => (w && h ? Math.round((w / (h / 100) ** 2) * 10) / 10 : null)
  const points: Point[] = birth ? [...growth].reverse().map(r => ({
    age: curveAge(new Date(r.date)), weight: r.data.weight ?? null, height: r.data.height ?? null, head: r.data.headCircumference ?? null, bmi: bmiOf(r.data.weight, r.data.height),
  })) : []
  const drops = sex && birth ? (['weight', 'height', 'head'] as Indicator[]).map(ind => {
    const measured = [...growth].reverse().map(r => ({ date: r.date, age: curveAge(new Date(r.date)), value: (ind === 'head' ? r.data.headCircumference : ind === 'weight' ? r.data.weight : r.data.height) as number })).filter(p => p.value)
    const d = growthDrop(ind, sex, measured)
    return d && { ind, ...d }
  }).filter(Boolean) as ({ ind: Indicator } & NonNullable<ReturnType<typeof growthDrop>>)[] : []

  const chart = (indicator: Indicator, title: string, unit: string, color: string, label: string) => (
    <div>
      <p className="mb-1 text-[0.86rem] font-semibold">{title}</p>
      {sex ? <PercentileChart indicator={indicator} sex={sex} points={points} unit={unit} color={color} /> : <Trend data={points.map(p => ({ ...p, label: ageLabel(Math.floor(p.age), L) }))} unit={unit} series={[{ key: indicator, label, color }]} />}
    </div>
  )

  return (
    <div className="grid gap-5">
      {drops.length > 0 && (
        <div className="grid gap-1.5 rounded-[14px] border border-[#F6CFCA] bg-[#FDF3F2] px-4 py-3 text-[0.9rem] text-[#B8372C]">
          {drops.map(d => (
            <p key={d.ind} className="flex items-start gap-2"><TrendingDown size={17} className="mt-0.5 shrink-0" />
              <span><b>{L('Cassure de la courbe')} :</b> {L(INDICATOR_LABEL[d.ind])} {L('a perdu {n} écart(s) type depuis le').replace('{n}', String(d.drop))} {formatDateFR(d.from.date)} ({percentileLabel(d.ind, sex, d.from.age, d.from.value)?.label} → {percentileLabel(d.ind, sex, d.to.age, d.to.value)?.label}).</span></p>
          ))}
        </div>
      )}

      <Section title={L('Croissance')} hint={ageNow !== null ? `${L('Âge')} : ${ageLabel(monthsBetween(birth!, new Date()), L)}${corrected !== null ? ` · ${L('âge corrigé')} : ${ageLabel(Math.floor(corrected), L)}` : ''}` : undefined}>
        <form className="grid grid-cols-2 gap-3 sm:grid-cols-[150px_1fr_1fr_1fr_auto] sm:items-end" onSubmit={e => {
          e.preventDefault()
          onSave('GROWTH', form.date, cleanNumbers({ weight: form.weight, height: form.height, headCircumference: form.headCircumference }, ['weight', 'height', 'headCircumference']), () => setForm({ date: today(), weight: '', height: '', headCircumference: '' }))
        }}>
          <Field id="g-date" label={L('Date')} type="date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} className="col-span-2 sm:col-span-1" />
          <Field id="g-weight" label={L('Poids')} type="number" unit="kg" value={form.weight} onChange={v => setForm(f => ({ ...f, weight: v }))} />
          <Field id="g-height" label={L('Taille')} type="number" unit="cm" value={form.height} onChange={v => setForm(f => ({ ...f, height: v }))} />
          <Field id="g-head" label={L('Périmètre crânien')} type="number" unit="cm" value={form.headCircumference} onChange={v => setForm(f => ({ ...f, headCircumference: v }))} />
          <Button type="submit" disabled={saving || (!form.weight && !form.height && !form.headCircumference)}>{L('Ajouter')}</Button>
        </form>
        <div className="grid gap-4 lg:grid-cols-2">
          {chart('weight', L('Poids (kg)'), 'kg', COLORS.primary, L('Poids'))}
          {chart('height', L('Taille (cm)'), 'cm', COLORS.blue, L('Taille'))}
          {points.some(p => p.head) && chart('head', L('Périmètre crânien (cm)'), 'cm', COLORS.violet, L('PC'))}
          {points.some(p => p.bmi) && chart('bmi', L('IMC (kg/m²)'), 'kg/m²', COLORS.amber, L('IMC'))}
        </div>
        {birth && <p className="text-[0.78rem] text-[#5A6B65]">{L(sex ? 'Courbes de l’OMS : P3, P15, P50 (médiane), P85, P97. En rouge : en dehors de P3 à P97.' : 'Indiquez le sexe de l’enfant (Modifier) pour afficher les courbes de l’OMS.')}{premature && ageNow !== null && ageNow < 24 ? ` ${L('Prématuré : les mesures sont placées à l’âge corrigé jusqu’à 2 ans.')}` : ''}</p>}
        {growth.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[0.88rem]">
              <thead className="text-[0.72rem] uppercase tracking-[0.07em] text-[#5A6B65]"><tr><th className="py-2 text-start">{L('Date')}</th><th className="text-start">{L('Âge')}</th><th className="text-end">{L('Poids')}</th><th className="text-end">{L('Taille')}</th><th className="text-end">{L('PC')}</th><th className="text-end">{L('IMC')}</th><th /></tr></thead>
              <tbody>
                {growth.map(r => {
                  const age = birth ? curveAge(new Date(r.date)) : 0
                  const bmi = bmiOf(r.data.weight, r.data.height)
                  const info = (ind: Indicator, v?: number | null) => (birth ? percentileLabel(ind, sex, age, v) : null)
                  return (
                    <tr key={r.id} className="border-t border-[#E3EAE7]">
                      <td className="py-1.5 font-mono">{formatDateFR(r.date)}</td>
                      <td>{birth ? ageLabel(monthsBetween(birth, new Date(r.date)), L) : '—'}</td>
                      <td className="text-end tabular-nums"><Measure value={r.data.weight} info={info('weight', r.data.weight)} /></td>
                      <td className="text-end tabular-nums"><Measure value={r.data.height} info={info('height', r.data.height)} /></td>
                      <td className="text-end tabular-nums"><Measure value={r.data.headCircumference} info={info('head', r.data.headCircumference)} /></td>
                      <td className="text-end tabular-nums"><Measure value={bmi} info={info('bmi', bmi)} /></td>
                      <td className="w-10"><DeleteButton onDelete={() => onDelete(r.id)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={L('Naissance et antécédents')} hint={L('Le terme sert à calculer l’âge corrigé des prématurés.')}
        action={premature ? <span className="rounded-full bg-[#FBEED6] px-2.5 py-1 text-[0.8rem] font-bold text-[#99600B]">{L('Prématuré')} · {ga} SA</span> : undefined}>
        <form className="grid gap-3" onSubmit={e => {
          e.preventDefault()
          const data = { ...cleanNumbers(b, BIRTH_NUMBERS), delivery: b.delivery || null, feeding: b.feeding || null }
          onSave('BIRTH', undefined, data, undefined, birthRec?.id)
        }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field id="b-ga" label={L('Terme')} unit="SA" type="number" step="1" value={b.gestationalWeeks} onChange={setBirth('gestationalWeeks')} placeholder="39" />
            <Field id="b-gad" label={L('+ jours')} type="number" step="1" value={b.gestationalDays} onChange={setBirth('gestationalDays')} placeholder="0" />
            <Field id="b-w" label={L('Poids de naissance')} unit="kg" type="number" value={b.birthWeight} onChange={setBirth('birthWeight')} />
            <Field id="b-l" label={L('Taille de naissance')} unit="cm" type="number" value={b.birthLength} onChange={setBirth('birthLength')} />
            <Field id="b-h" label={L('PC de naissance')} unit="cm" type="number" value={b.birthHead} onChange={setBirth('birthHead')} />
            <Field id="b-a1" label={L('Apgar 1 min')} type="number" step="1" value={b.apgar1} onChange={setBirth('apgar1')} />
            <Field id="b-a5" label={L('Apgar 5 min')} type="number" step="1" value={b.apgar5} onChange={setBirth('apgar5')} />
            <div className="space-y-1.5"><Label htmlFor="b-del">{L('Accouchement')}</Label>
              <NativeSelect id="b-del" value={b.delivery} onChange={e => setBirth('delivery')(e.target.value)}><option value="">—</option>{Object.entries(DELIVERY).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div className="space-y-1.5"><Label htmlFor="b-feed">{L('Alimentation')}</Label>
              <NativeSelect id="b-feed" value={b.feeding} onChange={e => setBirth('feeding')(e.target.value)}><option value="">—</option>{Object.entries(FEEDING).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
            </div>
            <Field id="b-all" label={L('Allergies')} value={b.allergies} onChange={setBirth('allergies')} placeholder={L('ex. protéines de lait de vache')} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="b-neo">{L('Période néonatale')}</Label><Textarea id="b-neo" rows={2} value={b.neonatal} onChange={e => setBirth('neonatal')(e.target.value)} placeholder={L('ex. ictère traité par photothérapie, hospitalisation en néonatologie…')} /></div>
          <div className="flex justify-end"><Button type="submit" disabled={saving}>{birthRec ? L('Mettre à jour') : L('Enregistrer')}</Button></div>
        </form>
      </Section>
    </div>
  )
}
