import { useState } from 'react'
import { Baby } from 'lucide-react'
import { cn, formatDateFR } from '../lib/utils'
import { Patient } from '../types'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { NativeSelect } from '../components/ui/native-select'
import { ClinicalRecord, cleanNumbers, today, useRecords } from './records'
import { COLORS, Empty, Field, RecordMeta, Section, Trend } from './ui'

type Pregnancy = { lmp: string; status: 'ONGOING' | 'DELIVERED' | 'ENDED'; gravidity?: number | null; parity?: number | null; outcome?: string | null; notes?: string | null }
type Visit = { pregnancyId: string; type: 'VISIT' | 'ULTRASOUND' | 'LAB'; weight?: number | null; systolic?: number | null; diastolic?: number | null; fundalHeight?: number | null; fetalHeartRate?: number | null; notes?: string | null }
type Followup = { contraception?: string | null; lastSmear?: string | null; cycle?: string | null; notes?: string | null }

const DAY = 86_400_000
const VISIT_TYPE: Record<Visit['type'], string> = { VISIT: 'Consultation', ULTRASOUND: 'Échographie', LAB: 'Bilan' }
const STATUS: Record<Pregnancy['status'], string> = { ONGOING: 'En cours', DELIVERED: 'Accouchée', ENDED: 'Interrompue' }

/** Weeks of amenorrhoea (SA) at a date, from the last menstrual period: "12 SA + 3 j". */
export function gestationalAge(lmp: string, at: Date = new Date()) {
  const days = Math.floor((at.getTime() - new Date(`${lmp}T00:00:00`).getTime()) / DAY)
  return { weeks: Math.floor(days / 7), days: days % 7, total: days }
}
const saLabel = (lmp: string, at?: Date) => { const g = gestationalAge(lmp, at); return `${g.weeks} SA${g.days ? ` + ${g.days} j` : ''}` }
/** Due date: LMP + 280 days (Naegele). */
const dueDate = (lmp: string) => new Date(new Date(`${lmp}T00:00:00`).getTime() + 280 * DAY)

function PregnancyCard({ pregnancy, visits, onSaveVisit, onStatus, onDelete, saving }: {
  pregnancy: ClinicalRecord<Pregnancy>; visits: ClinicalRecord<Visit>[]; saving: boolean
  onSaveVisit: (date: string, data: Visit) => void; onStatus: (status: Pregnancy['status']) => void; onDelete: (id: string) => void
}) {
  const p = pregnancy.data
  const ongoing = p.status === 'ONGOING'
  const g = gestationalAge(p.lmp)
  const trimester = g.weeks < 14 ? 1 : g.weeks < 28 ? 2 : 3
  const [form, setForm] = useState({ date: today(), type: 'VISIT' as Visit['type'], weight: '', systolic: '', diastolic: '', fundalHeight: '', fetalHeartRate: '', notes: '' })
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const weights = [...visits].reverse().filter(v => v.data.weight).map(v => ({ label: saLabel(p.lmp, new Date(v.date)).split(' +')[0], weight: v.data.weight }))

  return (
    <div className="grid gap-4 rounded-xl border border-[#D8E1DD] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[1.15rem] font-extrabold">
            <Baby size={20} className="text-primary" />
            {ongoing ? saLabel(p.lmp) : `Grossesse du ${formatDateFR(p.lmp)}`}
            <span className={cn('rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold', ongoing ? 'bg-[#DCEEE7] text-primary' : 'bg-[#E9EFEC] text-[#5A6B65]')}>{STATUS[p.status]}</span>
          </p>
          <p className="text-[0.9rem] text-[#5A6B65]">
            DDR {formatDateFR(p.lmp)} · terme prévu le <b className="text-[#14231E]">{formatDateFR(dueDate(p.lmp))}</b>
            {ongoing && ` · ${trimester}${trimester === 1 ? 'er' : 'e'} trimestre`}
            {p.gravidity !== null && p.gravidity !== undefined ? ` · G${p.gravidity}P${p.parity ?? 0}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ongoing && <Button size="sm" variant="outline" onClick={() => onStatus('DELIVERED')}>Accouchée</Button>}
          {ongoing && <Button size="sm" variant="ghost" onClick={() => onStatus('ENDED')}>Interrompue</Button>}
          <Button size="sm" variant="ghost" className="text-[#B8372C]" onClick={() => { if (window.confirm('Supprimer cette grossesse et son suivi ?')) { visits.forEach(v => onDelete(v.id)); onDelete(pregnancy.id) } }}>Supprimer</Button>
        </div>
      </div>

      {ongoing && (
        <form className="grid gap-2.5 rounded-xl bg-[#F2F5F3] p-3 sm:grid-cols-4" onSubmit={e => {
          e.preventDefault()
          onSaveVisit(form.date, { pregnancyId: pregnancy.id, type: form.type, ...cleanNumbers({ weight: form.weight, systolic: form.systolic, diastolic: form.diastolic, fundalHeight: form.fundalHeight, fetalHeartRate: form.fetalHeartRate }, ['weight', 'systolic', 'diastolic', 'fundalHeight', 'fetalHeartRate']), notes: form.notes || null })
          setForm({ date: today(), type: 'VISIT', weight: '', systolic: '', diastolic: '', fundalHeight: '', fetalHeartRate: '', notes: '' })
        }}>
          <div className="space-y-1.5"><Label htmlFor={`pv-type-${pregnancy.id}`}>Type</Label>
            <NativeSelect id={`pv-type-${pregnancy.id}`} value={form.type} onChange={e => set('type')(e.target.value)}>{Object.entries(VISIT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
          </div>
          <Field id={`pv-date-${pregnancy.id}`} label="Date" type="date" value={form.date} onChange={set('date')} />
          <Field id={`pv-w-${pregnancy.id}`} label="Poids" type="number" unit="kg" value={form.weight} onChange={set('weight')} />
          <div className="grid grid-cols-2 gap-2">
            <Field id={`pv-s-${pregnancy.id}`} label="TA sys." type="number" value={form.systolic} onChange={set('systolic')} />
            <Field id={`pv-d-${pregnancy.id}`} label="dia." type="number" value={form.diastolic} onChange={set('diastolic')} />
          </div>
          <Field id={`pv-hu-${pregnancy.id}`} label="Hauteur utérine" type="number" unit="cm" value={form.fundalHeight} onChange={set('fundalHeight')} />
          <Field id={`pv-bcf-${pregnancy.id}`} label="BCF" type="number" unit="bpm" value={form.fetalHeartRate} onChange={set('fetalHeartRate')} />
          <Field id={`pv-n-${pregnancy.id}`} label="Observations / résultats" className="sm:col-span-2" value={form.notes} onChange={set('notes')} />
          <Button type="submit" className="sm:col-span-4" disabled={saving}>Ajouter au suivi ({saLabel(p.lmp, new Date(form.date))})</Button>
        </form>
      )}

      {weights.length >= 2 && <div><p className="mb-1 text-[0.86rem] font-semibold">Prise de poids</p><Trend data={weights} unit="kg" height={160} series={[{ key: 'weight', label: 'Poids', color: COLORS.primary }]} /></div>}

      {visits.length === 0 ? <Empty>Aucune consultation de suivi pour cette grossesse.</Empty> : (
        <ul className="grid gap-2">
          {visits.map(v => (
            <li key={v.id} className="grid gap-0.5 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
              <RecordMeta record={v} onDelete={() => onDelete(v.id)} />
              <p><b>{VISIT_TYPE[v.data.type]}</b> · {saLabel(p.lmp, new Date(v.date))}
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

/** Gynecology-obstetrics: pregnancy follow-up from the last period, and gynecological follow-up. */
export default function Gynecology({ patient }: { patient: Patient }) {
  const { ofKind, save, remove, isLoading } = useRecords(patient.id, 'GYNECOLOGY')
  const pregnancies = ofKind<Pregnancy>('PREGNANCY')
  const visits = ofKind<Visit>('PREGNANCY_VISIT')
  const followups = ofKind<Followup>('GYN_FOLLOWUP')
  const [declare, setDeclare] = useState({ lmp: '', gravidity: '', parity: '' })
  const [fu, setFu] = useState({ contraception: '', lastSmear: '', cycle: '', notes: '' })
  const last = followups[0]?.data
  const smearYears = last?.lastSmear ? (Date.now() - new Date(last.lastSmear).getTime()) / (365.25 * DAY) : null

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">Chargement…</p>

  return (
    <div className="grid gap-5">
      <Section title="Grossesse" hint="À partir de la date des dernières règles (DDR) : semaines d’aménorrhée, trimestre et terme prévu.">
        {!pregnancies.some(p => p.data.status === 'ONGOING') && (
          <form className="grid gap-3 sm:grid-cols-[180px_120px_120px_auto] sm:items-end" onSubmit={e => {
            e.preventDefault()
            save.mutate({ kind: 'PREGNANCY', date: declare.lmp, data: { lmp: declare.lmp, status: 'ONGOING', ...cleanNumbers({ gravidity: declare.gravidity, parity: declare.parity }, ['gravidity', 'parity']) } }, { onSuccess: () => setDeclare({ lmp: '', gravidity: '', parity: '' }) })
          }}>
            <Field id="preg-lmp" label="Date des dernières règles" type="date" value={declare.lmp} onChange={v => setDeclare(d => ({ ...d, lmp: v }))} />
            <Field id="preg-g" label="Gestité" type="number" value={declare.gravidity} onChange={v => setDeclare(d => ({ ...d, gravidity: v }))} />
            <Field id="preg-p" label="Parité" type="number" value={declare.parity} onChange={v => setDeclare(d => ({ ...d, parity: v }))} />
            <Button type="submit" disabled={!declare.lmp || save.isPending}>Déclarer la grossesse</Button>
          </form>
        )}
        {declare.lmp && <p className="text-[0.9rem] text-[#5A6B65]">Aujourd’hui : {saLabel(declare.lmp)} · terme prévu le {formatDateFR(dueDate(declare.lmp))}</p>}
        {pregnancies.length === 0 ? <Empty>Aucune grossesse suivie.</Empty> : pregnancies.map(p => (
          <PregnancyCard key={p.id} pregnancy={p} visits={visits.filter(v => v.data.pregnancyId === p.id)} saving={save.isPending}
            onSaveVisit={(date, data) => save.mutate({ kind: 'PREGNANCY_VISIT', date, data })}
            onStatus={status => save.mutate({ id: p.id, kind: 'PREGNANCY', data: { ...p.data, status } })}
            onDelete={id => remove.mutate(id)} />
        ))}
      </Section>

      <Section title="Suivi gynécologique" hint={smearYears !== null && smearYears > 3 ? undefined : 'Contraception, frottis et cycle.'}
        action={smearYears !== null && smearYears > 3 ? <span className="rounded-full bg-[#FBEED6] px-2.5 py-1 text-[0.8rem] font-bold text-[#99600B]">Frottis de plus de 3 ans</span> : undefined}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => {
          e.preventDefault()
          save.mutate({ kind: 'GYN_FOLLOWUP', data: { contraception: fu.contraception || null, lastSmear: fu.lastSmear || null, cycle: fu.cycle || null, notes: fu.notes || null } }, { onSuccess: () => setFu({ contraception: '', lastSmear: '', cycle: '', notes: '' }) })
        }}>
          <Field id="fu-c" label="Contraception" value={fu.contraception} onChange={v => setFu(x => ({ ...x, contraception: v }))} placeholder={last?.contraception || 'ex. DIU cuivre, pilule…'} />
          <Field id="fu-s" label="Dernier frottis" type="date" value={fu.lastSmear} onChange={v => setFu(x => ({ ...x, lastSmear: v }))} />
          <Field id="fu-cy" label="Cycle" value={fu.cycle} onChange={v => setFu(x => ({ ...x, cycle: v }))} placeholder={last?.cycle || 'ex. régulier, 28 j'} />
          <Field id="fu-n" label="Notes" value={fu.notes} onChange={v => setFu(x => ({ ...x, notes: v }))} />
          <Button type="submit" className="sm:col-span-2" disabled={save.isPending || (!fu.contraception && !fu.lastSmear && !fu.cycle && !fu.notes)}>Enregistrer</Button>
        </form>
        {followups.length > 0 && (
          <ul className="grid gap-2 border-t border-[#E3EAE7] pt-3">
            {followups.map(r => (
              <li key={r.id} className="grid gap-0.5 text-[0.9rem]">
                <RecordMeta record={r} onDelete={() => remove.mutate(r.id)} />
                <p>{[r.data.contraception && `Contraception : ${r.data.contraception}`, r.data.lastSmear && `Frottis : ${formatDateFR(r.data.lastSmear)}`, r.data.cycle && `Cycle : ${r.data.cycle}`].filter(Boolean).join(' · ')}</p>
                {r.data.notes && <p className="text-[#5A6B65]">{r.data.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
