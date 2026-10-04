import { useEffect, useState } from 'react'
import { useL } from '../../lib/labels'
import { cn, formatDateFR } from '../../lib/utils'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { ClinicalRecord, today } from '../records'
import { COLORS, Empty, Field, Section, toPoints, Trend } from '../ui'
import { Exam, GlaucomaPlan, Imaging, num, Side, SIDE_LABEL, vaDecimal, VisualField } from './shared'
import { mdSlope } from './VisualFieldTab'

type Props = {
  exams: ClinicalRecord<Exam>[]; fields: ClinicalRecord<VisualField>[]; images: ClinicalRecord<Imaging>[]; plans: ClinicalRecord<GlaucomaPlan>[]
  onSave: (data: GlaucomaPlan, id?: string) => void; saving: boolean
}

/** Glaucoma follow-up on one screen: target pressure, treatment, pressure / RNFL / visual field / acuity over time. */
export default function GlaucomaTab({ exams, fields, images, plans, onSave, saving }: Props) {
  const L = useL()
  const plan = plans[0]
  const blank = { diagnosisOd: '', diagnosisOs: '', targetIopOd: '', targetIopOs: '', treatment: '', nextVisualField: '', notes: '' }
  const [f, setF] = useState(blank)
  useEffect(() => {
    const p = plan?.data
    setF(p ? {
      diagnosisOd: p.diagnosisOd || '', diagnosisOs: p.diagnosisOs || '', targetIopOd: p.targetIopOd?.toString() || '', targetIopOs: p.targetIopOs?.toString() || '',
      treatment: p.treatment || '', nextVisualField: p.nextVisualField || '', notes: p.notes || '',
    } : blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id])
  const set = (k: keyof typeof blank) => (v: string) => setF(x => ({ ...x, [k]: v }))
  const save = () => onSave({
    diagnosisOd: f.diagnosisOd || null, diagnosisOs: f.diagnosisOs || null, targetIopOd: num(f.targetIopOd), targetIopOs: num(f.targetIopOs),
    treatment: f.treatment || null, nextVisualField: f.nextVisualField || null, notes: f.notes || null,
  }, plan?.id)

  const key = (s: Side) => (s === 'OD' ? 'od' : 'os') as 'od' | 'os'
  const lastIop = (s: Side) => exams.find(e => e.data[key(s)]?.iop != null)
  const lastVa = (s: Side) => exams.find(e => vaDecimal(e.data[key(s)]?.vaCorrected) !== null)
  const lastField = (s: Side) => fields.find(x => x.data.eye === s && x.data.md != null)
  const lastRnfl = (s: Side) => images.find(x => x.data.modality === 'OCT_RNFL' && x.data.eye === s && x.data.rnflAvg != null)
  const target = (s: Side) => (s === 'OD' ? plan?.data.targetIopOd : plan?.data.targetIopOs)
  const due = plan?.data.nextVisualField
  const overdue = !!due && due < today()

  const iopChart = (s: Side) => toPoints(exams.filter(e => e.data[key(s)]?.iop != null), r => ({ iop: r.data[key(s)]?.iop }))

  return (
    <div className="grid gap-5">
      {due && (
        <p role={overdue ? 'alert' : 'status'} className={cn('rounded-xl px-4 py-3 text-sm font-semibold', overdue ? 'bg-[#FBE3E0] text-[#B8372C]' : 'bg-[#DCEEE7] text-primary')}>
          {overdue ? L('Champ visuel en retard : prévu le') : L('Prochain champ visuel prévu le')} {formatDateFR(due)}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(['OD', 'OS'] as Side[]).map(s => {
          const iop = lastIop(s)?.data[key(s)]?.iop
          const t = target(s)
          const above = iop != null && t != null && iop > t
          const slope = mdSlope(fields.filter(x => x.data.eye === s))
          return (
            <Section key={s} title={L(SIDE_LABEL[s])} hint={(s === 'OD' ? plan?.data.diagnosisOd : plan?.data.diagnosisOs) || undefined}
              action={iop != null && t != null ? <span className={cn('rounded-full px-2.5 py-1 text-[0.75rem] font-bold', above ? 'bg-[#FBE3E0] text-[#B8372C]' : 'bg-[#DFF1E6] text-[#1E7A45]')}>{above ? L('Au-dessus de la cible') : L('Contrôlé sous traitement')}</span> : undefined}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.9rem] sm:grid-cols-4">
                <div><dt className="text-[0.78rem] text-[#5A6B65]">{L('PIO')}</dt><dd className="text-lg font-extrabold tabular-nums">{iop ?? '—'}<span className="text-xs font-semibold"> mmHg</span></dd>{t != null && <dd className="text-[0.75rem] text-[#5A6B65]">{L('cible')} ≤ {t}</dd>}</div>
                <div><dt className="text-[0.78rem] text-[#5A6B65]">{L('RNFL moyen')}</dt><dd className="text-lg font-extrabold tabular-nums">{lastRnfl(s)?.data.rnflAvg ?? '—'}<span className="text-xs font-semibold"> µm</span></dd></div>
                <div><dt className="text-[0.78rem] text-[#5A6B65]">MD</dt><dd className="text-lg font-extrabold tabular-nums">{lastField(s)?.data.md ?? '—'}<span className="text-xs font-semibold"> dB</span></dd>{slope !== null && <dd className={cn('text-[0.75rem]', slope <= -1 ? 'font-bold text-[#B8372C]' : 'text-[#5A6B65]')}>{slope > 0 ? '+' : ''}{slope} dB/{L('an')}</dd>}</div>
                <div><dt className="text-[0.78rem] text-[#5A6B65]">{L('AV corrigée')}</dt><dd className="text-lg font-extrabold">{lastVa(s)?.data[key(s)]?.vaCorrected ?? '—'}</dd></div>
              </dl>
              <Trend data={iopChart(s)} unit="mmHg" height={160} series={[{ key: 'iop', label: L('PIO'), color: s === 'OD' ? COLORS.primary : COLORS.blue }]}
                references={t != null ? [{ y: t, label: `${L('cible')} ${t}` }] : [{ y: 21, label: '21 mmHg' }]} />
            </Section>
          )
        })}
      </div>

      <Section title={L('Plan de suivi du glaucome')} hint={plan ? `${L('Mis à jour le')} ${formatDateFR(plan.date)}` : L('Diagnostic, pression cible, traitement et prochain champ visuel.')}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); save() }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="gl-dxod" label={`${L('Diagnostic')} OD`} value={f.diagnosisOd} onChange={set('diagnosisOd')} placeholder={L('ex. Glaucome primitif à angle ouvert')} />
            <Field id="gl-dxos" label={`${L('Diagnostic')} ${L('OG')}`} value={f.diagnosisOs} onChange={set('diagnosisOs')} />
            <Field id="gl-tod" label={`${L('Pression cible')} OD`} type="number" step="1" unit="mmHg" value={f.targetIopOd} onChange={set('targetIopOd')} />
            <Field id="gl-tos" label={`${L('Pression cible')} ${L('OG')}`} type="number" step="1" unit="mmHg" value={f.targetIopOs} onChange={set('targetIopOs')} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="gl-trt">{L('Traitement en cours (collyres, laser, chirurgie)')}</Label><Textarea id="gl-trt" rows={2} value={f.treatment} onChange={e => set('treatment')(e.target.value)} placeholder={L('ex. Latanoprost 1 goutte le soir ODG')} /></div>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
            <Field id="gl-next" label={L('Prochain champ visuel')} type="date" value={f.nextVisualField} onChange={set('nextVisualField')} />
            <Field id="gl-notes" label={L('Notes')} value={f.notes} onChange={set('notes')} />
            <Button type="submit" disabled={saving}>{L('Enregistrer le plan')}</Button>
          </div>
        </form>
        {!plan && exams.length === 0 && <Empty>{L('Les courbes se remplissent avec les examens, champs visuels et OCT.')}</Empty>}
      </Section>
    </div>
  )
}
