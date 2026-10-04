import { useEffect, useState } from 'react'
import { useL } from '../../lib/labels'
import { cn, formatDateFR } from '../../lib/utils'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, today } from '../records'
import { COLORS, DeleteButton, Field, Section, Trend } from '../ui'
import { byDate } from '../ophthalmology/shared'
import { ANTICOAG, Badge, nums, Plan, Reading, Risk, RISK_CATEGORY } from './shared'

const RISKS: [keyof Omit<Risk, 'notes'>, string][] = [
  ['hypertension', 'Hypertension artérielle'], ['diabetes', 'Diabète'], ['smoking', 'Tabac'], ['dyslipidemia', 'Dyslipidémie'],
  ['obesity', 'Obésité'], ['familyHistory', 'Antécédents familiaux'], ['sedentary', 'Sédentarité'],
]
const noRisk = Object.fromEntries(RISKS.map(([k]) => [k, false])) as Omit<Risk, 'notes'>
const PLAN_NUMBERS = ['inrMin', 'inrMax', 'bpTargetSys', 'bpTargetDia']
const emptyPlan = { diagnosis: '', anticoagulation: 'NONE', inrMin: '', inrMax: '', riskCategory: '', bpTargetSys: '', bpTargetDia: '', treatment: '', nextVisit: '', notes: '' }
const toForm = (p?: Plan) => ({ ...emptyPlan, ...Object.fromEntries(Object.entries(p || {}).map(([k, v]) => [k, v == null ? '' : String(v)])) })

/** Care plan (diagnosis, anticoagulation, targets), risk factors, then blood pressure / heart rate / INR follow-up. */
export default function FollowUpTab({ plans, risks, readings, saving, onSave, onDelete }: {
  plans: ClinicalRecord<Plan>[]; risks: ClinicalRecord<Risk>[]; readings: ClinicalRecord<Reading>[]; saving: boolean
  onSave: (kind: string, date: string | undefined, data: object, done?: () => void, id?: string) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const plan = plans[0]
  const [p, setP] = useState(() => toForm(plan?.data))
  const [risk, setRisk] = useState(noRisk)
  const [reading, setReading] = useState({ date: today(), systolic: '', diastolic: '', heartRate: '', inr: '' })
  useEffect(() => setP(toForm(plan?.data)), [plan?.id])
  useEffect(() => { if (risks[0]) setRisk({ ...noRisk, ...risks[0].data }) }, [risks[0]?.id])
  const setPlan = (k: keyof typeof emptyPlan) => (v: string) => setP(x => ({ ...x, [k]: v }))

  const count = RISKS.filter(([k]) => risk[k]).length
  const sysTarget = plan?.data.bpTargetSys ?? 140
  const diaTarget = plan?.data.bpTargetDia ?? 90
  const inrMin = plan?.data.inrMin ?? 2
  const inrMax = plan?.data.inrMax ?? 3
  const bp = byDate(readings.filter(r => r.data.systolic || r.data.heartRate), d => ({ sys: d.systolic, dia: d.diastolic, hr: d.heartRate }))
  const inr = byDate(readings.filter(r => r.data.inr), d => ({ inr: d.inr }))
  const lastInr = readings.find(r => r.data.inr)?.data.inr
  const lastBp = readings.find(r => r.data.systolic)?.data
  const due = plan?.data.nextVisit ? Math.round((new Date(plan.data.nextVisit).getTime() - Date.now()) / 86_400_000) : null

  return (
    <div className="grid gap-5">
      <Section title={L('Plan de suivi')} hint={plan ? `${L('Mis à jour le')} ${formatDateFR(plan.date)}` : L('Diagnostic, traitement anticoagulant et objectifs du patient.')}
        action={due !== null ? <Badge tone={due < 0 ? 'bad' : due <= 14 ? 'warn' : 'info'}>{due < 0 ? L('Contrôle en retard de {n} j').replace('{n}', String(-due)) : L('Prochain contrôle dans {n} j').replace('{n}', String(due))}</Badge> : undefined}>
        <form className="grid gap-3" onSubmit={e => {
          e.preventDefault()
          const data = { ...p, ...nums(p, PLAN_NUMBERS), riskCategory: p.riskCategory || null, nextVisit: p.nextVisit || null }
          for (const k of ['diagnosis', 'treatment', 'notes'] as const) (data as any)[k] = p[k] || null
          onSave('CARDIO_PLAN', undefined, data, undefined, plan?.id)
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="cp-diag" label={L('Diagnostic principal')} value={p.diagnosis} onChange={setPlan('diagnosis')} placeholder={L('ex. FA paroxystique, cardiopathie ischémique…')} />
            <div className="space-y-1.5"><Label htmlFor="cp-risk">{L('Niveau de risque cardiovasculaire')}</Label>
              <NativeSelect id="cp-risk" value={p.riskCategory} onChange={e => setPlan('riskCategory')(e.target.value)}>
                <option value="">—</option>{Object.entries(RISK_CATEGORY).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <div className="col-span-2 space-y-1.5 sm:col-span-1"><Label htmlFor="cp-ac">{L('Anticoagulant / antiagrégant')}</Label>
              <NativeSelect id="cp-ac" value={p.anticoagulation} onChange={e => {
                const v = e.target.value
                // AVK: the usual INR range is 2-3, prefilled when empty.
                setP(x => ({ ...x, anticoagulation: v, ...(v === 'VKA' && !x.inrMin && !x.inrMax ? { inrMin: '2', inrMax: '3' } : {}) }))
              }}>
                {Object.entries(ANTICOAG).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}
              </NativeSelect>
            </div>
            {p.anticoagulation === 'VKA' && <>
              <Field id="cp-inr1" label={L('INR cible min')} type="number" step="0.1" value={p.inrMin} onChange={setPlan('inrMin')} />
              <Field id="cp-inr2" label={L('INR cible max')} type="number" step="0.1" value={p.inrMax} onChange={setPlan('inrMax')} />
            </>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field id="cp-sys" label={L('Objectif TA systolique')} type="number" unit="mmHg" value={p.bpTargetSys} onChange={setPlan('bpTargetSys')} placeholder="130" />
            <Field id="cp-dia" label={L('Objectif TA diastolique')} type="number" unit="mmHg" value={p.bpTargetDia} onChange={setPlan('bpTargetDia')} placeholder="80" />
            <Field id="cp-next" label={L('Prochain contrôle')} type="date" value={p.nextVisit} onChange={setPlan('nextVisit')} className="col-span-2 sm:col-span-1" />
          </div>
          <div className="space-y-1.5"><Label htmlFor="cp-tt">{L('Traitement en cours')}</Label><Textarea id="cp-tt" rows={2} value={p.treatment} onChange={e => setPlan('treatment')(e.target.value)} placeholder={L('ex. Bisoprolol 5 mg, Apixaban 5 mg x2, Atorvastatine 40 mg')} /></div>
          <div className="flex justify-end"><Button type="submit" disabled={saving}>{plan ? L('Mettre à jour le plan') : L('Enregistrer le plan')}</Button></div>
        </form>
      </Section>

      <Section title={L('Facteurs de risque cardiovasculaire')} hint={risks[0] ? `${L('Dernière évaluation le')} ${formatDateFR(risks[0].date)}` : L('Cochez les facteurs présents puis enregistrez.')}
        action={<Badge tone={count >= 3 ? 'bad' : count > 0 ? 'warn' : 'ok'}>{count} {count > 1 ? L('facteurs') : L('facteur')}</Badge>}>
        <div className="flex flex-wrap gap-2">
          {RISKS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={risk[k]} onClick={() => setRisk(r => ({ ...r, [k]: !r[k] }))}
              className={cn('rounded-full border px-3.5 py-2 text-[0.88rem] font-semibold', risk[k] ? 'border-[#B8372C] bg-[#FBE3E0] text-[#B8372C]' : 'border-[#D8E1DD] bg-white text-[#5A6B65] hover:bg-[#E9EFEC]')}>
              {risk[k] ? '✓ ' : ''}{L(label)}
            </button>
          ))}
        </div>
        <div><Button size="sm" disabled={saving} onClick={() => onSave('CARDIO_RISK', undefined, risk)}>{L('Enregistrer l’évaluation')}</Button></div>
      </Section>

      <Section title={L('Tension, fréquence cardiaque et INR')}
        action={<div className="flex flex-wrap gap-1.5">
          {lastBp?.systolic != null && <Badge tone={lastBp.systolic > sysTarget || (lastBp.diastolic ?? 0) > diaTarget ? 'bad' : 'ok'}>TA {lastBp.systolic}/{lastBp.diastolic ?? '?'}</Badge>}
          {lastInr != null && plan?.data.anticoagulation === 'VKA' && <Badge tone={lastInr < inrMin || lastInr > inrMax ? 'bad' : 'ok'}>INR {lastInr} {lastInr < inrMin ? L('(trop bas)') : lastInr > inrMax ? L('(trop haut)') : L('(dans la cible)')}</Badge>}
        </div>}>
        <form className="grid grid-cols-2 gap-3 sm:grid-cols-[150px_1fr_1fr_1fr_1fr_auto] sm:items-end" onSubmit={e => {
          e.preventDefault()
          onSave('CARDIO_READING', reading.date, nums(reading, ['systolic', 'diastolic', 'heartRate', 'inr']), () => setReading({ date: today(), systolic: '', diastolic: '', heartRate: '', inr: '' }))
        }}>
          <Field id="cr-date" label={L('Date')} type="date" value={reading.date} onChange={v => setReading(r => ({ ...r, date: v }))} className="col-span-2 sm:col-span-1" />
          <Field id="cr-sys" label={L('Systolique')} type="number" unit="mmHg" value={reading.systolic} onChange={v => setReading(r => ({ ...r, systolic: v }))} />
          <Field id="cr-dia" label={L('Diastolique')} type="number" unit="mmHg" value={reading.diastolic} onChange={v => setReading(r => ({ ...r, diastolic: v }))} />
          <Field id="cr-hr" label={L('Fréquence')} type="number" unit="bpm" value={reading.heartRate} onChange={v => setReading(r => ({ ...r, heartRate: v }))} />
          <Field id="cr-inr" label={L('INR')} type="number" step="0.1" value={reading.inr} onChange={v => setReading(r => ({ ...r, inr: v }))} />
          <Button type="submit" className="col-span-2 sm:col-span-1" disabled={saving || (!reading.systolic && !reading.heartRate && !reading.inr)}>{L('Ajouter')}</Button>
        </form>
        <div className="grid gap-4 lg:grid-cols-2">
          <div><p className="mb-1 text-[0.86rem] font-semibold">{L('Tension (mmHg) et fréquence')} <span className="font-normal text-[#5A6B65]">· {L('objectif')} {sysTarget}/{diaTarget}</span></p>
            <Trend data={bp} series={[{ key: 'sys', label: L('Systolique'), color: COLORS.red }, { key: 'dia', label: L('Diastolique'), color: COLORS.blue }, { key: 'hr', label: L('Fréquence'), color: COLORS.amber }]} references={[{ y: sysTarget, label: String(sysTarget) }, { y: diaTarget, label: String(diaTarget) }]} />
          </div>
          <div><p className="mb-1 text-[0.86rem] font-semibold">INR <span className="font-normal text-[#5A6B65]">· {L('cible')} {inrMin} – {inrMax}</span></p>
            <Trend data={inr} series={[{ key: 'inr', label: 'INR', color: COLORS.violet }]} references={[{ y: inrMin, label: String(inrMin) }, { y: inrMax, label: String(inrMax) }]} />
          </div>
        </div>
        {readings.length > 0 && (
          <ul className="grid gap-1 border-t border-[#E3EAE7] pt-3 text-[0.9rem]">
            {readings.slice(0, 8).map(r => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span><span className="font-mono text-[#5A6B65]">{formatDateFR(r.date)}</span>{[r.data.systolic && ` · TA ${r.data.systolic}/${r.data.diastolic ?? '?'}`, r.data.heartRate && ` · ${r.data.heartRate} bpm`, r.data.inr && ` · INR ${r.data.inr}`].filter(Boolean).join('')}</span>
                <DeleteButton onDelete={() => onDelete(r.id)} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
