import { useState } from 'react'
import { Baby, FileText, Pencil } from 'lucide-react'
import { useL } from '../../lib/labels'
import { cn, formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, cleanNumbers, today } from '../records'
import { COLORS, Empty, Field, RecordMeta, Section, Trend } from '../ui'
import { dueDate, gestationalAge, saLabel } from './calc'
import { DELIVERY, gravidityParity, lmpOf, PastPregnancy, Pregnancy, STATUS, useDeclaration, Visit, VISIT_TYPE } from './shared'

type Put = (kind: string, date: string | undefined, data: object, done?: () => void, id?: string) => void

function PregnancyCard({ pregnancy, visits, onSave, onDelete, saving, onDeclare }: {
  pregnancy: ClinicalRecord<Pregnancy>; visits: ClinicalRecord<Visit>[]; saving: boolean; onDeclare: () => void
  onSave: Put; onDelete: (id: string) => void
}) {
  const L = useL()
  const p = pregnancy.data
  const lmp = lmpOf(p)
  const ongoing = p.status === 'ONGOING'
  const g = gestationalAge(lmp)
  const trimester = g.weeks < 14 ? 1 : g.weeks < 28 ? 2 : 3
  const [form, setForm] = useState({ date: today(), type: 'VISIT' as Visit['type'], weight: '', systolic: '', diastolic: '', fundalHeight: '', fetalHeartRate: '', notes: '' })
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const str = (v: unknown) => (v == null ? '' : String(v))
  const [editing, setEditing] = useState<null | 'details' | 'delivery'>(null)
  const [d, setD] = useState({ bloodGroup: str(p.bloodGroup), rhesus: str(p.rhesus), fetuses: str(p.fetuses ?? 1), risk: str(p.risk), deliveryDate: str(p.deliveryDate) || today(), deliveryMode: str(p.deliveryMode), babyWeight: str(p.babyWeight), babySex: str(p.babySex) })
  const setDetail = (k: keyof typeof d) => (v: string) => setD(x => ({ ...x, [k]: v }))
  const update = (patch: Partial<Pregnancy>) => onSave('PREGNANCY', undefined, { ...p, ...patch }, () => setEditing(null), pregnancy.id)
  const weights = [...visits].reverse().filter(v => v.data.weight).map(v => ({ label: saLabel(lmp, new Date(v.date)).split(' +')[0], weight: v.data.weight }))
  const bp = visits.find(v => v.data.systolic)?.data
  const highBp = bp && ((bp.systolic ?? 0) >= 140 || (bp.diastolic ?? 0) >= 90)

  return (
    <div className="grid gap-4 rounded-xl border border-[#D8E1DD] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[1.15rem] font-extrabold">
            <Baby size={20} className="text-primary" />
            {ongoing ? saLabel(lmp) : `${L('Grossesse du')} ${formatDateFR(p.lmp)}`}
            <span className={cn('rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold', ongoing ? 'bg-[#DCEEE7] text-primary' : 'bg-[#E9EFEC] text-[#5A6B65]')}>{L(STATUS[p.status])}</span>
            {(p.fetuses ?? 1) > 1 && <span className="rounded-full bg-[#ECE6F7] px-2.5 py-0.5 text-[0.75rem] font-bold text-[#5731B7]">{p.fetuses === 2 ? L('Jumeaux') : `${p.fetuses} ${L('fœtus')}`}</span>}
            {p.rhesus === 'NEG' && <span className="rounded-full bg-[#FBE3E0] px-2.5 py-0.5 text-[0.75rem] font-bold text-[#B8372C]">{L('Rhésus négatif')}</span>}
            {highBp && ongoing && <span className="rounded-full bg-[#FBE3E0] px-2.5 py-0.5 text-[0.75rem] font-bold text-[#B8372C]">TA {bp!.systolic}/{bp!.diastolic}</span>}
          </p>
          <p className="text-[0.9rem] text-[#5A6B65]">
            {L('DDR')} {formatDateFR(p.lmp)}{p.datingLmp ? ` (${L('datation corrigée par l’écho')})` : ''} · {L('terme prévu le')} <b className="text-[#14231E]">{formatDateFR(dueDate(lmp))}</b>
            {ongoing && ` · ${L(trimester === 1 ? '1er trimestre' : trimester === 2 ? '2e trimestre' : '3e trimestre')}`}
            {p.gravidity != null ? ` · G${p.gravidity}P${p.parity ?? 0}` : ''}
            {p.bloodGroup ? ` · ${L('Groupe')} ${p.bloodGroup}${p.rhesus === 'POS' ? '+' : p.rhesus === 'NEG' ? '−' : ''}` : ''}
          </p>
          {p.risk && <p className="text-[0.88rem] text-[#99600B]">{L('Facteurs de risque')} : {p.risk}</p>}
          {p.status === 'DELIVERED' && p.deliveryDate && (
            <p className="text-[0.9rem]">{L('Accouchement le')} <b>{formatDateFR(p.deliveryDate)}</b>{p.deliveryMode ? ` · ${L(DELIVERY[p.deliveryMode])}` : ''}{p.babyWeight ? ` · ${p.babyWeight} kg` : ''}{p.babySex ? ` · ${p.babySex === 'F' ? L('fille') : L('garçon')}` : ''} · {saLabel(lmp, new Date(p.deliveryDate))}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ongoing && <Button size="sm" variant="outline" onClick={onDeclare}><FileText size={15} className="me-1" />{L('Déclaration de grossesse')}</Button>}
          <Button size="sm" variant="outline" onClick={() => setEditing(editing === 'details' ? null : 'details')}><Pencil size={14} className="me-1" />{L('Détails')}</Button>
          {ongoing && <Button size="sm" variant="outline" onClick={() => setEditing('delivery')}>{L('Accouchée')}</Button>}
          {ongoing && <Button size="sm" variant="ghost" onClick={() => update({ status: 'ENDED' })}>{L('Interrompue')}</Button>}
          <Button size="sm" variant="ghost" className="text-[#B8372C]" onClick={() => { if (window.confirm(L('Supprimer cette grossesse et son suivi ?'))) { visits.forEach(v => onDelete(v.id)); onDelete(pregnancy.id) } }}>{L('Supprimer')}</Button>
        </div>
      </div>

      {editing === 'details' && (
        <form className="grid grid-cols-2 gap-3 rounded-xl bg-[#F2F5F3] p-3 sm:grid-cols-4" onSubmit={e => {
          e.preventDefault()
          update({ bloodGroup: (d.bloodGroup || null) as Pregnancy['bloodGroup'], rhesus: (d.rhesus || null) as Pregnancy['rhesus'], fetuses: Number(d.fetuses) || 1, risk: d.risk || null })
        }}>
          <div className="space-y-1.5"><Label htmlFor={`pd-g-${pregnancy.id}`}>{L('Groupe sanguin')}</Label>
            <NativeSelect id={`pd-g-${pregnancy.id}`} value={d.bloodGroup} onChange={e => setDetail('bloodGroup')(e.target.value)}><option value="">—</option>{['A', 'B', 'AB', 'O'].map(x => <option key={x} value={x}>{x}</option>)}</NativeSelect>
          </div>
          <div className="space-y-1.5"><Label htmlFor={`pd-rh-${pregnancy.id}`}>{L('Rhésus')}</Label>
            <NativeSelect id={`pd-rh-${pregnancy.id}`} value={d.rhesus} onChange={e => setDetail('rhesus')(e.target.value)}><option value="">—</option><option value="POS">{L('Positif')}</option><option value="NEG">{L('Négatif')}</option></NativeSelect>
          </div>
          <Field id={`pd-f-${pregnancy.id}`} label={L('Nombre de fœtus')} type="number" step="1" value={d.fetuses} onChange={setDetail('fetuses')} />
          <Field id={`pd-r-${pregnancy.id}`} label={L('Facteurs de risque')} value={d.risk} onChange={setDetail('risk')} placeholder={L('ex. HTA, diabète, utérus cicatriciel')} />
          <Button type="submit" className="col-span-2 sm:col-span-4" disabled={saving}>{L('Enregistrer')}</Button>
        </form>
      )}
      {editing === 'delivery' && (
        <form className="grid grid-cols-2 gap-3 rounded-xl bg-[#F2F5F3] p-3 sm:grid-cols-4" onSubmit={e => {
          e.preventDefault()
          update({ status: 'DELIVERED', deliveryDate: d.deliveryDate, deliveryMode: (d.deliveryMode || null) as Pregnancy['deliveryMode'], babyWeight: d.babyWeight ? Number(d.babyWeight.replace(',', '.')) : null, babySex: (d.babySex || null) as Pregnancy['babySex'] })
        }}>
          <Field id={`dl-d-${pregnancy.id}`} label={L('Date de l’accouchement')} type="date" value={d.deliveryDate} onChange={setDetail('deliveryDate')} />
          <div className="space-y-1.5"><Label htmlFor={`dl-m-${pregnancy.id}`}>{L('Mode')}</Label>
            <NativeSelect id={`dl-m-${pregnancy.id}`} value={d.deliveryMode} onChange={e => setDetail('deliveryMode')(e.target.value)}><option value="">—</option>{Object.entries(DELIVERY).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
          </div>
          <Field id={`dl-w-${pregnancy.id}`} label={L('Poids du bébé')} unit="kg" type="number" value={d.babyWeight} onChange={setDetail('babyWeight')} />
          <div className="space-y-1.5"><Label htmlFor={`dl-s-${pregnancy.id}`}>{L('Sexe')}</Label>
            <NativeSelect id={`dl-s-${pregnancy.id}`} value={d.babySex} onChange={e => setDetail('babySex')(e.target.value)}><option value="">—</option><option value="F">{L('Fille')}</option><option value="M">{L('Garçon')}</option></NativeSelect>
          </div>
          <div className="col-span-2 flex justify-end gap-2 sm:col-span-4">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>{L('Annuler')}</Button>
            <Button type="submit" disabled={saving || !d.deliveryDate}>{L('Enregistrer l’accouchement')}</Button>
          </div>
        </form>
      )}

      {ongoing && (
        <form className="grid gap-2.5 rounded-xl bg-[#F2F5F3] p-3 sm:grid-cols-4" onSubmit={e => {
          e.preventDefault()
          onSave('PREGNANCY_VISIT', form.date, { pregnancyId: pregnancy.id, type: form.type, ...cleanNumbers({ weight: form.weight, systolic: form.systolic, diastolic: form.diastolic, fundalHeight: form.fundalHeight, fetalHeartRate: form.fetalHeartRate }, ['weight', 'systolic', 'diastolic', 'fundalHeight', 'fetalHeartRate']), notes: form.notes || null },
            () => setForm({ date: today(), type: 'VISIT', weight: '', systolic: '', diastolic: '', fundalHeight: '', fetalHeartRate: '', notes: '' }))
        }}>
          <div className="space-y-1.5"><Label htmlFor={`pv-type-${pregnancy.id}`}>{L('Type')}</Label>
            <NativeSelect id={`pv-type-${pregnancy.id}`} value={form.type} onChange={e => set('type')(e.target.value)}>{Object.entries(VISIT_TYPE).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
          </div>
          <Field id={`pv-date-${pregnancy.id}`} label={L('Date')} type="date" value={form.date} onChange={set('date')} />
          <Field id={`pv-w-${pregnancy.id}`} label={L('Poids')} type="number" unit="kg" value={form.weight} onChange={set('weight')} />
          <div className="grid grid-cols-2 gap-2">
            <Field id={`pv-s-${pregnancy.id}`} label={L('TA sys.')} type="number" value={form.systolic} onChange={set('systolic')} />
            <Field id={`pv-d-${pregnancy.id}`} label={L('dia.')} type="number" value={form.diastolic} onChange={set('diastolic')} />
          </div>
          <Field id={`pv-hu-${pregnancy.id}`} label={L('Hauteur utérine')} type="number" unit="cm" value={form.fundalHeight} onChange={set('fundalHeight')} />
          <Field id={`pv-bcf-${pregnancy.id}`} label={L('BCF')} type="number" unit="bpm" value={form.fetalHeartRate} onChange={set('fetalHeartRate')} />
          <Field id={`pv-n-${pregnancy.id}`} label={L('Observations / résultats')} className="sm:col-span-2" value={form.notes} onChange={set('notes')} />
          <Button type="submit" className="sm:col-span-4" disabled={saving}>{L('Ajouter au suivi')} ({saLabel(lmp, new Date(form.date))})</Button>
        </form>
      )}

      {weights.length >= 2 && <div><p className="mb-1 text-[0.86rem] font-semibold">{L('Prise de poids')}</p><Trend data={weights} unit="kg" height={160} series={[{ key: 'weight', label: L('Poids'), color: COLORS.primary }]} /></div>}

      {visits.length === 0 ? <Empty>{L('Aucune consultation de suivi pour cette grossesse.')}</Empty> : (
        <ul className="grid gap-2">
          {visits.map(v => (
            <li key={v.id} className="grid gap-0.5 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
              <RecordMeta record={v} onDelete={() => onDelete(v.id)} />
              <p><b>{L(VISIT_TYPE[v.data.type])}</b> · {saLabel(lmp, new Date(v.date))}
                {[v.data.weight && `${v.data.weight} kg`, v.data.systolic && `TA ${v.data.systolic}/${v.data.diastolic ?? '?'}`, v.data.fundalHeight && `HU ${v.data.fundalHeight} cm`, v.data.fetalHeartRate && `BCF ${v.data.fetalHeartRate}`].filter(Boolean).map(x => ` · ${x}`).join('')}
              </p>
              {v.data.notes && <p className="text-[#5A6B65]">{v.data.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Pregnancies: declaration from the last period (G/P prefilled from the history), follow-up visits, details and delivery. */
export default function PregnancyTab({ patient, pregnancies, visits, past, saving, onSave, onDelete }: {
  patient: Patient; pregnancies: ClinicalRecord<Pregnancy>[]; visits: ClinicalRecord<Visit>[]; past: ClinicalRecord<PastPregnancy>[]; saving: boolean
  onSave: Put; onDelete: (id: string) => void
}) {
  const L = useL()
  const declaration = useDeclaration(patient)
  const gp = gravidityParity(past.map(x => x.data), true)
  const [declare, setDeclare] = useState({ lmp: '', gravidity: '', parity: '' })

  return (
    <Section title={L('Grossesse')} hint={L('À partir de la date des dernières règles (DDR) : semaines d’aménorrhée, trimestre et terme prévu.')}>
      {!pregnancies.some(p => p.data.status === 'ONGOING') && (
        <form className="grid gap-3 sm:grid-cols-[180px_120px_120px_auto] sm:items-end" onSubmit={e => {
          e.preventDefault()
          onSave('PREGNANCY', declare.lmp, { lmp: declare.lmp, status: 'ONGOING', fetuses: 1, gravidity: declare.gravidity === '' ? gp.g : Number(declare.gravidity), parity: declare.parity === '' ? gp.p : Number(declare.parity) },
            () => setDeclare({ lmp: '', gravidity: '', parity: '' }))
        }}>
          <Field id="preg-lmp" label={L('Date des dernières règles')} type="date" value={declare.lmp} onChange={v => setDeclare(d => ({ ...d, lmp: v }))} />
          <Field id="preg-g" label={L('Gestité')} type="number" value={declare.gravidity} placeholder={String(gp.g)} onChange={v => setDeclare(d => ({ ...d, gravidity: v }))} />
          <Field id="preg-p" label={L('Parité')} type="number" value={declare.parity} placeholder={String(gp.p)} onChange={v => setDeclare(d => ({ ...d, parity: v }))} />
          <Button type="submit" disabled={!declare.lmp || saving}>{L('Déclarer la grossesse')}</Button>
        </form>
      )}
      {declare.lmp && <p className="text-[0.9rem] text-[#5A6B65]">{L('Aujourd’hui')} : {saLabel(declare.lmp)} · {L('terme prévu le')} {formatDateFR(dueDate(declare.lmp))}</p>}
      {pregnancies.length === 0 ? <Empty>{L('Aucune grossesse suivie.')}</Empty> : pregnancies.map(p => (
        <PregnancyCard key={p.id} pregnancy={p} visits={visits.filter(v => v.data.pregnancyId === p.id)} saving={saving}
          onSave={onSave} onDelete={onDelete} onDeclare={() => declaration.mutate(p.data)} />
      ))}
    </Section>
  )
}
