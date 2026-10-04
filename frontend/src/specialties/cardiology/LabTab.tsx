import { useState } from 'react'
import { useL } from '../../lib/labels'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, today } from '../records'
import { COLORS, Empty, Field, RecordMeta, Section, Trend } from '../ui'
import { byDate } from '../ophthalmology/shared'
import { ckdStage, CreatinineUnit, egfr, LDL_TARGET } from './calc'
import { ageYears, Badge, Lab, nums, Plan, RISK_CATEGORY } from './shared'

const NUMBERS: [keyof Lab, string, string][] = [
  ['totalChol', 'Cholestérol total', 'g/L'], ['ldl', 'LDL-cholestérol', 'g/L'], ['hdl', 'HDL-cholestérol', 'g/L'], ['tg', 'Triglycérides', 'g/L'],
  ['potassium', 'Potassium', 'mmol/L'], ['sodium', 'Sodium', 'mmol/L'], ['ntprobnp', 'NT-proBNP', 'pg/mL'], ['hba1c', 'HbA1c', '%'],
]
const UNIT: Record<CreatinineUnit, string> = { MG_L: 'mg/L', UMOL_L: 'µmol/L', MG_DL: 'mg/dL' }
const blank = () => ({ date: today(), creatinine: '', creatinineUnit: 'MG_L', troponin: '', notes: '', ...Object.fromEntries(NUMBERS.map(([k]) => [k, ''])) }) as Record<string, string>

/** Lipids, kidney function (eGFR CKD-EPI 2021 computed live), electrolytes, NT-proBNP; LDL compared with the target of the risk level. */
export default function LabTab({ patient, labs, plan, saving, onSave, onDelete }: {
  patient: Patient; labs: ClinicalRecord<Lab>[]; plan?: Plan; saving: boolean
  onSave: (date: string, data: object, done: () => void) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const [v, setV] = useState(blank)
  const set = (k: string) => (x: string) => setV(o => ({ ...o, [k]: x }))
  const female = patient.sex === 'F'
  const gfrOf = (creat: number | null | undefined, unit: CreatinineUnit, date: string) => {
    const age = ageYears(patient.birthDate, new Date(date))
    return creat && age !== null && patient.sex ? egfr(creat, unit, age, female) : null
  }
  const live = gfrOf(Number(v.creatinine.replace(',', '.')) || null, v.creatinineUnit as CreatinineUnit, v.date)
  const target = plan?.riskCategory ? LDL_TARGET[plan.riskCategory] : null
  const curve = byDate(labs, d => ({ ldl: d.ldl, egfr: d.egfr }))

  return (
    <div className="grid gap-5">
      <Section title={L('Bilan biologique')} hint={target ? `${L('Cible LDL')} < ${target} g/L (${L('risque')} ${L(RISK_CATEGORY[plan!.riskCategory!]).toLowerCase()}, ESC/EAS 2019)` : L('Renseignez le niveau de risque dans le plan de suivi pour voir la cible LDL.')}>
        <form className="grid gap-3" onSubmit={e => {
          e.preventDefault()
          const data = { ...nums(v, [...NUMBERS.map(n => n[0]), 'creatinine']), creatinineUnit: v.creatinineUnit, egfr: live, troponin: v.troponin || null, notes: v.notes || null }
          onSave(v.date, data, () => setV(blank()))
        }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field id="lab-date" label={L('Date du bilan')} type="date" value={v.date} onChange={set('date')} />
            {NUMBERS.slice(0, 4).map(([k, label, unit]) => <Field key={k} id={`lab-${k}`} label={L(label)} unit={unit} type="number" value={v[k]} onChange={set(k)} />)}
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F4F7F6] p-3 sm:grid-cols-[1fr_1fr_2fr] sm:items-end">
            <Field id="lab-creat" label={L('Créatinine')} type="number" value={v.creatinine} onChange={set('creatinine')} />
            <div className="space-y-1.5"><Label htmlFor="lab-unit">{L('Unité')}</Label>
              <NativeSelect id="lab-unit" value={v.creatinineUnit} onChange={e => set('creatinineUnit')(e.target.value)}>{Object.entries(UNIT).map(([k, x]) => <option key={k} value={k}>{x}</option>)}</NativeSelect>
            </div>
            <p className="col-span-2 text-[0.9rem] sm:col-span-1">
              {live !== null ? <>{L('DFG estimé')} <b className="text-lg">{live}</b> mL/min/1,73 m² · <Badge tone={live >= 60 ? 'ok' : live >= 30 ? 'warn' : 'bad'}>{L('Stade')} {ckdStage(live)}</Badge></>
                : <span className="text-[#5A6B65]">{patient.birthDate && patient.sex ? L('Le DFG (CKD-EPI 2021) se calcule dès la saisie de la créatinine.') : L('Âge ou sexe absent du dossier : DFG non calculé.')}</span>}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {NUMBERS.slice(4).map(([k, label, unit]) => <Field key={k} id={`lab-${k}`} label={L(label)} unit={unit} type="number" value={v[k]} onChange={set(k)} />)}
            <Field id="lab-tropo" label={L('Troponine')} value={v.troponin} onChange={set('troponin')} placeholder={L('ex. négative')} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="lab-notes">{L('Remarques')}</Label><Textarea id="lab-notes" rows={2} value={v.notes} onChange={e => set('notes')(e.target.value)} /></div>
          <div className="flex justify-end"><Button type="submit" disabled={saving}>{L('Enregistrer le bilan')}</Button></div>
        </form>
      </Section>

      {labs.length > 1 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title={L('LDL-cholestérol (g/L)')}><Trend data={curve.filter(p => p.ldl != null)} series={[{ key: 'ldl', label: 'LDL', color: COLORS.amber }]} references={target ? [{ y: target, label: `${L('cible')} ${target}` }] : []} /></Section>
          <Section title={L('DFG (mL/min/1,73 m²)')}><Trend data={curve.filter(p => p.egfr != null)} series={[{ key: 'egfr', label: 'DFG', color: COLORS.blue }]} references={[{ y: 60, label: '60' }, { y: 30, label: '30' }]} /></Section>
        </div>
      )}

      <Section title={L('Bilans précédents')}>
        {labs.length === 0 ? <Empty>{L('Aucun bilan enregistré.')}</Empty> : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {labs.map(r => {
              const d = r.data
              return (
                <li key={r.id} className="grid gap-1 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                  <RecordMeta record={r} onDelete={() => onDelete(r.id)} />
                  <p className="flex flex-wrap items-center gap-1.5">
                    {d.ldl != null && <Badge tone={target && d.ldl > target ? 'bad' : 'ok'}>LDL {d.ldl} g/L</Badge>}
                    {d.egfr != null && <Badge tone={d.egfr >= 60 ? 'ok' : d.egfr >= 30 ? 'warn' : 'bad'}>DFG {d.egfr} ({ckdStage(d.egfr)})</Badge>}
                    {d.potassium != null && <Badge tone={d.potassium < 3.5 || d.potassium > 5 ? 'bad' : 'ok'}>K⁺ {d.potassium}</Badge>}
                  </p>
                  <p className="text-[#5A6B65]">{[d.totalChol != null && `CT ${d.totalChol}`, d.hdl != null && `HDL ${d.hdl}`, d.tg != null && `TG ${d.tg}`, d.creatinine != null && `${L('Créat.')} ${d.creatinine} ${UNIT[d.creatinineUnit || 'MG_L']}`, d.sodium != null && `Na⁺ ${d.sodium}`, d.ntprobnp != null && `NT-proBNP ${d.ntprobnp}`, d.hba1c != null && `HbA1c ${d.hba1c} %`, d.troponin && `${L('Troponine')} ${d.troponin}`].filter(Boolean).join(' · ')}</p>
                  {d.notes && <p className="text-[#5A6B65]">{d.notes}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
