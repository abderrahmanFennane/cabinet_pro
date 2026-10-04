import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { useL } from '../../lib/labels'
import { apiError, useCabinetApi, useCabinetId } from '../../lib/hooks'
import { openAttachment } from '../../lib/files'
import { cn, formatDateFR } from '../../lib/utils'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, today } from '../records'
import { Empty, Field, RecordMeta, Section } from '../ui'
import { Thumb, uploadImage } from '../ophthalmology/shared'
import { datingFromCrl, efwCurve, efwPercentile, gestationalAge, hadlockEfw, saLabel } from './calc'
import { FLUID, lmpOf, Pregnancy, PRESENTATION, Ultrasound } from './shared'

const NUMBERS = ['crl', 'nuchal', 'bpd', 'hc', 'ac', 'fl', 'fetalHeartRate'] as const
const blank = () => ({ date: today(), fetus: '1', crl: '', nuchal: '', bpd: '', hc: '', ac: '', fl: '', fetalHeartRate: '', presentation: '', placenta: '', amnioticFluid: '', morphology: '', conclusion: '' })
const n = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
const pTone = (p: number) => (p < 3 || p > 97 ? 'bg-[#FBE3E0] text-[#B8372C]' : p < 10 || p > 90 ? 'bg-[#FBEED6] text-[#99600B]' : 'bg-[#DFF1E6] text-[#1E7A45]')

/** Obstetric ultrasounds of the current pregnancy: biometry, estimated fetal weight (Hadlock) on its growth curve, dating by CRL. */
export default function UltrasoundTab({ patientId, pregnancy, ultrasounds, saving, onSave, onDelete }: {
  patientId: string; pregnancy?: ClinicalRecord<Pregnancy>; ultrasounds: ClinicalRecord<Ultrasound>[]; saving: boolean
  onSave: (kind: string, date: string | undefined, data: object, done?: () => void, id?: string) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const cabinetApi = useCabinetApi()
  const cabinetId = useCabinetId()
  const [f, setF] = useState(blank)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof ReturnType<typeof blank>) => (v: string) => setF(x => ({ ...x, [k]: v }))
  if (!pregnancy) return <Section title={L('Échographies obstétricales')}><Empty>{L('Déclarez d’abord la grossesse (onglet Grossesse).')}</Empty></Section>

  const p = pregnancy.data
  const lmp = lmpOf(p)
  const twins = (p.fetuses ?? 1) > 1
  const mine = ultrasounds.filter(u => u.data.pregnancyId === pregnancy.id)
  const weeksAt = (date: string) => gestationalAge(lmp, new Date(`${date}T12:00:00`)).total / 7
  const efw = n(f.hc) && n(f.ac) && n(f.fl) ? hadlockEfw(n(f.hc)!, n(f.ac)!, n(f.fl)!) : null
  const efwP = efw ? efwPercentile(efw, weeksAt(f.date)) : null
  // First-trimester dating by the crown-rump length, against the original LMP.
  const dating = n(f.crl) ? datingFromCrl(n(f.crl)!, f.date, p.lmp) : null

  const submit = async () => {
    setBusy(true)
    try {
      const attachmentId = file ? await uploadImage(cabinetApi, patientId, file, `${L('Échographie')} ${f.date}`) : null
      const data = {
        pregnancyId: pregnancy.id, fetus: Number(f.fetus) || 1, ...Object.fromEntries(NUMBERS.map(k => [k, n(f[k])])), efw,
        presentation: f.presentation || null, amnioticFluid: f.amnioticFluid || null, placenta: f.placenta || null, morphology: f.morphology || null, conclusion: f.conclusion || null, attachmentId,
      }
      onSave('OB_ULTRASOUND', f.date, data, () => { setF(blank()); setFile(null) })
    } catch (err) { toast.error(apiError(err)) } finally { setBusy(false) }
  }

  const curve = efwCurve()
  const points = [...mine].reverse().filter(u => u.data.efw).map(u => ({ weeks: Math.round(weeksAt(u.date) * 10) / 10, [`f${u.data.fetus ?? 1}`]: u.data.efw }))
  const data = [...curve, ...points].sort((a, b) => a.weeks - b.weeks)

  return (
    <div className="grid gap-5">
      <Section title={L('Échographies obstétricales')} hint={`${L('Grossesse en cours')} : ${saLabel(lmp)}. ${L('Le poids fœtal estimé est calculé avec la formule de Hadlock (PC, PA, LF).')}`}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void submit() }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field id="us-date" label={`${L('Date')} (${saLabel(lmp, new Date(`${f.date}T12:00:00`))})`} type="date" value={f.date} onChange={set('date')} />
            {twins && <div className="space-y-1.5"><Label htmlFor="us-fetus">{L('Fœtus')}</Label>
              <NativeSelect id="us-fetus" value={f.fetus} onChange={e => set('fetus')(e.target.value)}>{Array.from({ length: p.fetuses ?? 2 }, (_, i) => <option key={i} value={i + 1}>{L('Fœtus')} {i + 1}</option>)}</NativeSelect>
            </div>}
            <Field id="us-crl" label={L('LCC')} unit="mm" type="number" value={f.crl} onChange={set('crl')} />
            <Field id="us-nt" label={L('Clarté nucale')} unit="mm" type="number" value={f.nuchal} onChange={set('nuchal')} />
            <Field id="us-bpd" label={L('BIP')} unit="mm" type="number" value={f.bpd} onChange={set('bpd')} />
            <Field id="us-hc" label={L('PC')} unit="mm" type="number" value={f.hc} onChange={set('hc')} />
            <Field id="us-ac" label={L('PA')} unit="mm" type="number" value={f.ac} onChange={set('ac')} />
            <Field id="us-fl" label={L('LF')} unit="mm" type="number" value={f.fl} onChange={set('fl')} />
            <Field id="us-bcf" label={L('BCF')} unit="bpm" type="number" value={f.fetalHeartRate} onChange={set('fetalHeartRate')} />
          </div>
          {(efw || dating || (n(f.nuchal) ?? 0) >= 3.5) && (
            <div className="grid gap-1.5 rounded-xl bg-[#F4F7F6] px-3 py-2.5 text-[0.9rem]">
              {efw && <p>{L('Poids fœtal estimé')} : <b className="text-lg">{efw} g</b>{efwP !== null && <span className={cn('ms-2 rounded-full px-2 py-0.5 text-[0.8rem] font-bold', pTone(efwP))}>P{efwP}</span>}
                {efwP !== null && efwP < 10 && <span className="ms-2 text-[#B8372C]">{L('(petit poids pour l’âge gestationnel : à surveiller)')}</span>}
                {efwP !== null && efwP > 90 && <span className="ms-2 text-[#99600B]">{L('(gros poids pour l’âge gestationnel)')}</span>}</p>}
              {dating && <p>{L('LCC')} {f.crl} mm = <b>{Math.floor(dating.gaDays / 7)} SA + {dating.gaDays % 7} j</b>
                {dating.correct
                  ? <> · {L('écart de {n} jours avec la DDR').replace('{n}', String(Math.abs(dating.diff)))} <Button type="button" size="sm" variant="outline" className="ms-2" disabled={saving} onClick={() => onSave('PREGNANCY', undefined, { ...p, datingLmp: dating.lmp }, undefined, pregnancy.id)}>{L('Corriger la datation')}</Button></>
                  : <> · {L('concorde avec la DDR')}</>}</p>}
              {(n(f.nuchal) ?? 0) >= 3.5 && <p className="font-semibold text-[#B8372C]">{L('Clarté nucale ≥ 3,5 mm : avis spécialisé recommandé.')}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="us-pres">{L('Présentation')}</Label>
              <NativeSelect id="us-pres" value={f.presentation} onChange={e => set('presentation')(e.target.value)}><option value="">—</option>{Object.entries(PRESENTATION).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="us-fluid">{L('Liquide amniotique')}</Label>
              <NativeSelect id="us-fluid" value={f.amnioticFluid} onChange={e => set('amnioticFluid')(e.target.value)}><option value="">—</option>{Object.entries(FLUID).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
            </div>
            <Field id="us-plac" label={L('Placenta')} value={f.placenta} onChange={set('placenta')} placeholder={L('ex. antérieur, non bas inséré')} className="col-span-2 sm:col-span-1" />
          </div>
          <div className="space-y-1.5"><Label htmlFor="us-morph">{L('Morphologie')}</Label><Textarea id="us-morph" rows={2} value={f.morphology} onChange={e => set('morphology')(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="us-conc">{L('Conclusion')}</Label><Textarea id="us-conc" rows={2} value={f.conclusion} onChange={e => set('conclusion')(e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5"><Label htmlFor="us-file">{L('Image ou compte rendu de l’échographe (image ou PDF)')}</Label>
              <Input id="us-file" type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="cursor-pointer pt-2" />
            </div>
            <Button type="submit" disabled={saving || busy}>{busy ? L('Envoi…') : L('Enregistrer l’échographie')}</Button>
          </div>
        </form>
      </Section>

      {points.length > 0 && (
        <Section title={L('Croissance fœtale (poids estimé)')} hint={L('Courbes P10, P50 et P90 de Hadlock (1991).')}>
          <div style={{ height: 240 }} className="w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 24, left: -4, bottom: 0 }}>
                <CartesianGrid stroke="#E3EAE7" />
                <XAxis dataKey="weeks" type="number" domain={[20, 41]} ticks={[20, 24, 28, 32, 36, 40]} tickFormatter={(w: number) => `${w} SA`} fontSize={11} stroke="#8A9A94" />
                <YAxis fontSize={11} stroke="#8A9A94" width={48} />
                <Tooltip labelFormatter={(w: number) => `${w} SA`} formatter={(v: number, name: string) => [`${v} g`, name.startsWith('f') ? `${L('Fœtus')} ${name.slice(1)}` : name.toUpperCase()]} contentStyle={{ borderRadius: 10, border: '1px solid #D8E1DD', fontSize: 12 }} />
                <Line dataKey="p10" stroke="#E7A8A1" strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
                <Line dataKey="p50" stroke="#7FB8A4" dot={false} connectNulls isAnimationActive={false} />
                <Line dataKey="p90" stroke="#E7A8A1" strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
                {Array.from({ length: p.fetuses ?? 1 }, (_, i) => <Line key={i} dataKey={`f${i + 1}`} stroke={i ? '#6746A8' : '#12705A'} strokeWidth={2.5} dot={{ r: 3.5 }} connectNulls isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      <Section title={L('Échographies précédentes')}>
        {mine.length === 0 ? <Empty>{L('Aucune échographie enregistrée pour cette grossesse.')}</Empty> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {mine.map(r => {
              const d = r.data
              const pct = d.efw ? efwPercentile(d.efw, weeksAt(r.date)) : null
              return (
                <li key={r.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                  {d.attachmentId ? <div className="w-24"><Thumb patientId={patientId} attachmentId={d.attachmentId} onOpen={() => openAttachment(cabinetId!, patientId, d.attachmentId!).catch(() => undefined)} /></div> : <span />}
                  <div className="grid content-start gap-1">
                    <RecordMeta record={r} onDelete={() => onDelete(r.id)} />
                    <p className="flex flex-wrap items-center gap-1.5"><b>{saLabel(lmp, new Date(`${r.date.slice(0, 10)}T12:00:00`))}</b>{twins && <span className="text-[#5A6B65]">· {L('Fœtus')} {d.fetus ?? 1}</span>}
                      {d.efw && <><span>· {d.efw} g</span>{pct !== null && <span className={cn('rounded-full px-2 py-0.5 text-[0.78rem] font-bold', pTone(pct))}>P{pct}</span>}</>}</p>
                    <p className="text-[#5A6B65]">{[d.crl != null && `LCC ${d.crl}`, d.nuchal != null && `CN ${d.nuchal}`, d.bpd != null && `BIP ${d.bpd}`, d.hc != null && `PC ${d.hc}`, d.ac != null && `PA ${d.ac}`, d.fl != null && `LF ${d.fl}`].filter(Boolean).join(' · ')}{d.crl || d.bpd || d.hc ? ' mm' : ''}</p>
                    <p className="text-[#5A6B65]">{[d.fetalHeartRate && `BCF ${d.fetalHeartRate}`, d.presentation && L(PRESENTATION[d.presentation]), d.amnioticFluid && `${L('LA')} ${L(FLUID[d.amnioticFluid]).toLowerCase()}`, d.placenta && `${L('placenta')} ${d.placenta}`].filter(Boolean).join(' · ')}</p>
                    {d.morphology && <p>{d.morphology}</p>}
                    {d.conclusion && <p className="text-[#5A6B65]">{d.conclusion}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
      {p.datingLmp && <p className="text-[0.8rem] text-[#5A6B65]">{L('Datation corrigée par l’écho')} : {L('DDR théorique')} {formatDateFR(p.datingLmp)}. <button type="button" className="font-semibold text-primary" onClick={() => onSave('PREGNANCY', undefined, { ...p, datingLmp: null }, undefined, pregnancy.id)}>{L('Revenir à la DDR')}</button></p>}
    </div>
  )
}
