import { ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Trash2 } from 'lucide-react'
import { cn, formatDateFR } from '../lib/utils'
import { practitionerName } from '../lib/hooks'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { ClinicalRecord } from './records'
import { useL } from '../lib/labels'

/** Card used by every module: title, short help, optional action on the right. */
export function Section({ title, hint, action, children, className }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('grid gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px]', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[1.05rem] font-bold">{title}</h3>
          {hint && <p className="mt-0.5 text-[0.86rem] text-[#5A6B65]">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Labelled input bound to a string field of a form state. With min/max, a value outside the range is shown in red
 * with the allowed range (and an optional hint, e.g. "pachymétrie ?"), and the browser refuses to submit the form.
 */
export function Field({ id, label, value, onChange, type = 'text', unit, placeholder, className, step, min, max, hint }: {
  id: string; label: string; value: string; onChange: (value: string) => void; type?: string; unit?: string; placeholder?: string; className?: string; step?: string
  min?: number; max?: number; hint?: string
}) {
  const L = useL()
  const n = Number(String(value).replace(',', '.'))
  const out = type === 'number' && String(value).trim() !== '' && Number.isFinite(n) && ((min !== undefined && n < min) || (max !== undefined && n > max))
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}{unit && <span className="font-normal text-[#5A6B65]"> ({unit})</span>}</Label>
      <Input id={id} type={type} inputMode={type === 'number' ? 'decimal' : undefined} step={step ?? (type === 'number' ? 'any' : undefined)} min={min} max={max}
        value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} aria-invalid={out || undefined} aria-describedby={out ? `${id}-range` : undefined}
        className={cn(out && 'border-[#B8372C] focus-visible:ring-[#B8372C]')} />
      {out && <p id={`${id}-range`} className="text-[0.76rem] font-semibold leading-tight text-[#B8372C]">{L('Valeur impossible')} ({min ?? '…'} {L('à')} {max ?? '…'}{unit ? ` ${unit}` : ''}){hint ? ` · ${L(hint)}` : ''}</p>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-[#D8E1DD] p-4 text-center text-[0.9rem] text-[#5A6B65]">{children}</p>
}

export function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const L = useL()
  return (
    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-[#5A6B65] hover:text-[#B8372C]" aria-label={L('Supprimer')}
      onClick={() => { if (window.confirm(L('Supprimer cet élément ?'))) onDelete() }}>
      <Trash2 size={15} />
    </Button>
  )
}

/** Date + author line with a delete button, used under each saved record. */
export function RecordMeta({ record, onDelete }: { record: ClinicalRecord; onDelete?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[0.8rem] text-[#5A6B65]">
      <span><span className="font-mono">{formatDateFR(record.date)}</span>{record.practitioner ? ` · ${practitionerName(record.practitioner)}` : ''}</span>
      {onDelete && <DeleteButton onDelete={onDelete} />}
    </div>
  )
}

export type Series = { key: string; label: string; color: string }

/** Small line chart of values over time (oldest left), with optional reference lines (e.g. 140 mmHg). */
export function Trend({ data, series, unit, references = [], height = 200, empty }: {
  data: Record<string, any>[]; series: Series[]; unit?: string; references?: { y: number; label: string }[]; height?: number; empty?: string
}) {
  const L = useL()
  if (data.length < 2) return <Empty>{empty || L('La courbe apparaît à partir de deux mesures.')}</Empty>
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#E3EAE7" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#8A9A94" />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#8A9A94" width={44} domain={['auto', 'auto']} padding={{ top: 12, bottom: 14 }} />
          <Tooltip formatter={(v: number, name: string) => [`${v}${unit ? ` ${unit}` : ''}`, name]} contentStyle={{ borderRadius: 10, border: '1px solid #D8E1DD', fontSize: 12 }} />
          {references.map(r => <ReferenceLine key={r.label} y={r.y} ifOverflow="extendDomain" stroke="#B8372C" strokeDasharray="4 4" label={{ value: r.label, position: 'insideTopRight', fontSize: 10, fill: '#B8372C' }} />)}
          {series.map(s => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Records (newest first) -> chart points (oldest first) labelled dd/mm. */
export const toPoints = <T,>(records: ClinicalRecord<T>[], pick: (r: ClinicalRecord<T>) => Record<string, any>) =>
  [...records].reverse().map(r => ({ label: formatDateFR(r.date).slice(0, 5), ...pick(r) }))

export const COLORS = { primary: '#12705A', blue: '#2D5DAA', amber: '#99600B', red: '#B8372C', violet: '#6746A8' }
