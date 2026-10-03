import { ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Trash2 } from 'lucide-react'
import { cn, formatDateFR } from '../lib/utils'
import { practitionerName } from '../lib/hooks'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { ClinicalRecord } from './records'

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

/** Labelled input bound to a string field of a form state. */
export function Field({ id, label, value, onChange, type = 'text', unit, placeholder, className, step }: {
  id: string; label: string; value: string; onChange: (value: string) => void; type?: string; unit?: string; placeholder?: string; className?: string; step?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}{unit && <span className="font-normal text-[#5A6B65]"> ({unit})</span>}</Label>
      <Input id={id} type={type} inputMode={type === 'number' ? 'decimal' : undefined} step={step ?? (type === 'number' ? 'any' : undefined)} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-[#D8E1DD] p-4 text-center text-[0.9rem] text-[#5A6B65]">{children}</p>
}

export function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-[#5A6B65] hover:text-[#B8372C]" aria-label="Supprimer"
      onClick={() => { if (window.confirm('Supprimer cet élément ?')) onDelete() }}>
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
export function Trend({ data, series, unit, references = [], height = 200 }: {
  data: Record<string, any>[]; series: Series[]; unit?: string; references?: { y: number; label: string }[]; height?: number
}) {
  if (data.length < 2) return <Empty>La courbe apparaît à partir de deux mesures.</Empty>
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#E3EAE7" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#8A9A94" />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#8A9A94" width={44} domain={['auto', 'auto']} />
          <Tooltip formatter={(v: number, name: string) => [`${v}${unit ? ` ${unit}` : ''}`, name]} contentStyle={{ borderRadius: 10, border: '1px solid #D8E1DD', fontSize: 12 }} />
          {references.map(r => <ReferenceLine key={r.label} y={r.y} stroke="#B8372C" strokeDasharray="4 4" label={{ value: r.label, position: 'insideTopRight', fontSize: 10, fill: '#B8372C' }} />)}
          {series.map(s => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Records (newest first) -> chart points (oldest first) labelled dd/mm. */
export const toPoints = <T,>(records: ClinicalRecord<T>[], pick: (r: ClinicalRecord<T>) => Record<string, any>) =>
  [...records].reverse().map(r => ({ label: formatDateFR(r.date).slice(0, 5), ...pick(r) }))

export const COLORS = { primary: '#12705A', blue: '#2D5DAA', amber: '#99600B', red: '#B8372C', violet: '#6746A8' }
