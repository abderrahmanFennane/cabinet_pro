import { useState } from 'react'
import { toast } from 'sonner'
import { useL } from '../../lib/labels'
import { apiError, useCabinetApi } from '../../lib/hooks'
import { cn } from '../../lib/utils'
import { openAttachment } from '../../lib/files'
import { useCabinetId } from '../../lib/hooks'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, today } from '../records'
import { COLORS, Empty, Field, RecordMeta, Section, Trend } from '../ui'
import { byDate, num, SHORT, Side, SIDE_LABEL, Thumb, uploadImage, VisualField } from './shared'

const PROGRESSION: Record<NonNullable<VisualField['progression']>, [string, string]> = {
  STABLE: ['Stable', 'bg-[#DFF1E6] text-[#1E7A45]'], SUSPECT: ['Suspicion d’aggravation', 'bg-[#FBEED6] text-[#99600B]'], PROGRESSING: ['Aggravation', 'bg-[#FBE3E0] text-[#B8372C]'],
}

/** Mean deviation change per year (least squares), from at least 3 reliable fields over 6 months or more. */
export function mdSlope(fields: ClinicalRecord<VisualField>[]) {
  const pts = fields.filter(f => f.data.md != null && f.data.reliable !== false).map(f => ({ t: new Date(f.date).getTime() / (365.25 * 86_400_000), y: f.data.md as number }))
  if (pts.length < 3) return null
  const span = Math.max(...pts.map(p => p.t)) - Math.min(...pts.map(p => p.t))
  if (span < 0.5) return null
  const mt = pts.reduce((s, p) => s + p.t, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const slope = pts.reduce((s, p) => s + (p.t - mt) * (p.y - my), 0) / pts.reduce((s, p) => s + (p.t - mt) ** 2, 0)
  return Math.round(slope * 100) / 100
}

type Props = { patientId: string; fields: ClinicalRecord<VisualField>[]; onSave: (date: string, data: VisualField, done: () => void) => void; onDelete: (id: string) => void; saving: boolean }

export default function VisualFieldTab({ patientId, fields, onSave, onDelete, saving }: Props) {
  const L = useL()
  const cabinetApi = useCabinetApi()
  const cabinetId = useCabinetId()
  const empty = { date: today(), eye: 'OD' as Side, device: 'Humphrey', program: '24-2 SITA Standard', md: '', psd: '', vfi: '', reliable: true, pattern: '', progression: '', notes: '' }
  const [f, setF] = useState(empty)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof empty) => (v: string) => setF(x => ({ ...x, [k]: v }))

  const submit = async () => {
    setBusy(true)
    try {
      const attachmentId = file ? await uploadImage(cabinetApi, patientId, file, `Champ visuel ${SHORT[f.eye]} ${f.program} ${f.date}`) : null
      onSave(f.date, {
        eye: f.eye, device: f.device || null, program: f.program || null, md: num(f.md), psd: num(f.psd), vfi: num(f.vfi), reliable: f.reliable,
        pattern: f.pattern || null, progression: (f.progression || null) as VisualField['progression'], attachmentId, notes: f.notes || null,
      }, () => { setF({ ...empty, eye: f.eye }); setFile(null) })
    } catch (err) { toast.error(apiError(err)) } finally { setBusy(false) }
  }

  const byEye = (s: Side) => fields.filter(x => x.data.eye === s)
  const md = byDate(fields.filter(x => x.data.md != null), d => ({ [d.eye === 'OD' ? 'od' : 'os']: d.md }))

  return (
    <div className="grid gap-5">
      <Section title={L('Nouveau champ visuel')} hint={L('Saisissez les indices de l’appareil (Humphrey, Octopus…) et joignez l’impression ou la capture.')}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void submit() }}>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5"><Label htmlFor="vf-eye">{L('Œil')}</Label>
              <NativeSelect id="vf-eye" value={f.eye} onChange={e => setF(x => ({ ...x, eye: e.target.value as Side }))}>{(['OD', 'OS'] as Side[]).map(s => <option key={s} value={s}>{L(SIDE_LABEL[s])}</option>)}</NativeSelect>
            </div>
            <Field id="vf-dev" label={L('Appareil')} value={f.device} onChange={set('device')} />
            <Field id="vf-prog" label={L('Programme')} value={f.program} onChange={set('program')} placeholder="24-2, 10-2, 30-2…" />
            <Field id="vf-date" label={L('Date')} type="date" value={f.date} onChange={set('date')} />
            <Field id="vf-md" label="MD" type="number" step="0.01" unit="dB" value={f.md} onChange={set('md')} />
            <Field id="vf-psd" label="PSD" type="number" step="0.01" unit="dB" value={f.psd} onChange={set('psd')} />
            <Field id="vf-vfi" label="VFI" type="number" step="1" unit="%" value={f.vfi} onChange={set('vfi')} />
            <div className="space-y-1.5"><Label htmlFor="vf-prg">{L('Évolution (GPA)')}</Label>
              <NativeSelect id="vf-prg" value={f.progression} onChange={e => set('progression')(e.target.value)}>
                <option value="">—</option>{Object.entries(PROGRESSION).map(([k, [label]]) => <option key={k} value={k}>{L(label)}</option>)}
              </NativeSelect>
            </div>
          </div>
          <Field id="vf-pattern" label={L('Déficit observé')} value={f.pattern} onChange={set('pattern')} placeholder={L('ex. Déficit arciforme supérieur, ressaut nasal')} />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="space-y-1.5"><Label htmlFor="vf-file">{L('Impression du champ visuel (image ou PDF)')}</Label>
              <Input id="vf-file" type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="cursor-pointer pt-2" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={f.reliable} onChange={e => setF(x => ({ ...x, reliable: e.target.checked }))} />{L('Examen fiable')}</label>
            <Button type="submit" disabled={saving || busy || (!f.md && !f.pattern && !file)}>{L('Enregistrer')}</Button>
          </div>
        </form>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={L('Évolution de la MD')} hint={L('Déviation moyenne en dB : plus elle baisse, plus le champ visuel se dégrade.')}>
          <Trend data={md} unit="dB" series={[{ key: 'od', label: 'OD', color: COLORS.primary }, { key: 'os', label: L('OG'), color: COLORS.blue }]} empty={L('La courbe apparaît à partir de deux dates d’examen.')} />
        </Section>
        <Section title={L('Vitesse de progression')} hint={L('Pente de la MD (dB par an), à partir de 3 examens fiables sur 6 mois au moins.')}>
          <div className="grid grid-cols-2 gap-3">
            {(['OD', 'OS'] as Side[]).map(s => {
              const slope = mdSlope(byEye(s))
              return (
                <div key={s} className="rounded-xl bg-[#F7FAF8] p-3">
                  <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{L(SIDE_LABEL[s])}</p>
                  <p className={cn('text-2xl font-extrabold tabular-nums', slope === null ? 'text-[#5A6B65]' : slope <= -1 ? 'text-[#B8372C]' : slope <= -0.5 ? 'text-[#99600B]' : 'text-primary')}>
                    {slope === null ? '—' : `${slope > 0 ? '+' : ''}${slope.toFixed(2)}`}<span className="text-sm font-semibold"> dB/{L('an')}</span>
                  </p>
                  <p className="text-[0.8rem] text-[#5A6B65]">{byEye(s).length} {L('examen(s)')}</p>
                </div>
              )
            })}
          </div>
        </Section>
      </div>

      <Section title={L('Champs visuels')}>
        {fields.length === 0 ? <Empty>{L('Aucun champ visuel enregistré.')}</Empty> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {fields.map(r => (
              <li key={r.id} className="grid grid-cols-[96px_1fr] gap-3 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                {r.data.attachmentId ? <Thumb patientId={patientId} attachmentId={r.data.attachmentId} label={L(SHORT[r.data.eye])} onOpen={() => openAttachment(cabinetId!, patientId, r.data.attachmentId!).catch(() => undefined)} />
                  : <span className="flex aspect-[4/3] items-center justify-center rounded-xl bg-[#F2F5F3] font-bold text-[#5A6B65]">{L(SHORT[r.data.eye])}</span>}
                <div className="grid content-start gap-1">
                  <RecordMeta record={r} onDelete={() => onDelete(r.id)} />
                  <p><b>{L(SHORT[r.data.eye])}</b> · {[r.data.device, r.data.program].filter(Boolean).join(' ')}{r.data.reliable === false ? ` · ${L('peu fiable')}` : ''}</p>
                  <p className="font-mono">{r.data.md != null ? `MD ${r.data.md} dB` : ''}{r.data.psd != null ? ` · PSD ${r.data.psd} dB` : ''}{r.data.vfi != null ? ` · VFI ${r.data.vfi} %` : ''}</p>
                  {r.data.pattern && <p>{r.data.pattern}</p>}
                  {r.data.progression && <span className={cn('justify-self-start rounded-full px-2 py-0.5 text-[0.75rem] font-bold', PROGRESSION[r.data.progression][1])}>{L(PROGRESSION[r.data.progression][0])}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
