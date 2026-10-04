import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '../../lib/utils'
import { useL } from '../../lib/labels'
import { Empty } from '../ui'
import { Indicator, percentileCurves, percentileLabel, RANGE, Sex } from '../growth'

export type Growth = { weight?: number | null; height?: number | null; headCircumference?: number | null; notes?: string | null }
export type Vaccine = { code: string; lot?: string | null; notes?: string | null }
export type Birth = {
  gestationalWeeks?: number | null; gestationalDays?: number | null; birthWeight?: number | null; birthLength?: number | null; birthHead?: number | null
  apgar1?: number | null; apgar5?: number | null; delivery?: 'VAGINAL' | 'CESAREAN' | 'INSTRUMENTAL' | null
  feeding?: 'BREAST' | 'FORMULA' | 'MIXED' | 'DIVERSIFIED' | null; neonatal?: string | null; allergies?: string | null
}
export type Milestone = { code: string; ageMonths?: number | null; notes?: string | null }
export type Screening = { test: 'HEARING' | 'VISION' | 'MCHAT' | 'HIP' | 'ANEMIA' | 'DENTAL' | 'LEAD' | 'OTHER'; result: 'NORMAL' | 'TO_CONTROL' | 'ABNORMAL'; score?: number | null; notes?: string | null }

/**
 * Indicative calendar of the Moroccan national immunisation programme (PNI).
 * Check it against the calendar in force; ages are in months.
 */
export const PNI_CALENDAR: { code: string; label: string; months: number; girlsOnly?: boolean }[] = [
  { code: 'BCG', label: 'BCG', months: 0 },
  { code: 'HB0', label: 'Hépatite B (naissance)', months: 0 },
  { code: 'VPO0', label: 'Polio oral (VPO 0)', months: 0 },
  { code: 'PENTA1', label: 'Pentavalent 1 (DTC-Hib-HB)', months: 2 },
  { code: 'VPO1', label: 'Polio oral 1', months: 2 },
  { code: 'PNEUMO1', label: 'Pneumocoque 1', months: 2 },
  { code: 'ROTA1', label: 'Rotavirus 1', months: 2 },
  { code: 'PENTA2', label: 'Pentavalent 2', months: 3 },
  { code: 'VPO2', label: 'Polio oral 2', months: 3 },
  { code: 'ROTA2', label: 'Rotavirus 2', months: 3 },
  { code: 'PENTA3', label: 'Pentavalent 3', months: 4 },
  { code: 'VPO3', label: 'Polio oral 3', months: 4 },
  { code: 'VPI', label: 'Polio injectable (VPI)', months: 4 },
  { code: 'PNEUMO2', label: 'Pneumocoque 2', months: 4 },
  { code: 'RR1', label: 'Rougeole-Rubéole 1', months: 9 },
  { code: 'PNEUMO3', label: 'Pneumocoque (rappel)', months: 12 },
  { code: 'RR2', label: 'Rougeole-Rubéole 2', months: 18 },
  { code: 'DTC_R1', label: 'DTC rappel 1', months: 18 },
  { code: 'VPO_R1', label: 'Polio oral rappel 1', months: 18 },
  { code: 'DTC_R2', label: 'DTC rappel 2', months: 60 },
  { code: 'VPO_R2', label: 'Polio oral rappel 2', months: 60 },
  { code: 'HPV', label: 'Papillomavirus (HPV)', months: 132, girlsOnly: true },
]

export const monthsBetween = (from: Date, to: Date) => (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0)
export const ageLabel = (months: number, L: (s: string) => string = s => s) => (months < 1 ? L('Naissance') : months < 24 ? `${months} ${L('mois')}` : `${Math.floor(months / 12)} ${L('ans')}`)
const tickLabel = (m: number, L: (s: string) => string = s => s) => (m === 0 ? '0' : m < 24 ? `${m} ${L('m')}` : `${Math.round(m / 12)} ${L('a')}`)

export type Point = { age: number; weight: number | null; height: number | null; head: number | null; bmi: number | null }

/** One measure on the WHO percentile curves (P3, P15, P50, P85, P97), age on a true time scale. */
export function PercentileChart({ indicator, sex, points, unit, color }: { indicator: Indicator; sex: Sex; points: Point[]; unit: string; color: string }) {
  const L = useL()
  const measured = points.filter(p => p[indicator] != null && p.age <= RANGE[indicator][1])
  if (!measured.length) return <Empty>{L('Pas encore de mesure dans la tranche d’âge des courbes OMS.')}</Empty>
  const last = Math.max(...measured.map(p => p.age))
  const to = Math.min(RANGE[indicator][1], Math.max(24, Math.ceil((last + 6) / 6) * 6))
  const step = to <= 24 ? 3 : to <= 60 ? 12 : 24
  const curves = percentileCurves(indicator, sex, 0, to)
  const data = [...curves, ...measured.map(p => ({ age: Math.round(p.age * 10) / 10, value: p[indicator] }))].sort((a, b) => a.age - b.age)
  const curve = (key: string, stroke: string, dash?: string) => <Line key={key} dataKey={key} stroke={stroke} strokeWidth={key === 'p50' ? 1.6 : 1} strokeDasharray={dash} dot={false} connectNulls isAnimationActive={false} />
  return (
    <div style={{ height: 230 }} className="w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 30, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#E3EAE7" />
          <XAxis dataKey="age" type="number" domain={[0, to]} ticks={Array.from({ length: Math.floor(to / step) + 1 }, (_, i) => i * step)} tickFormatter={(m: number) => tickLabel(m, L)} fontSize={11} stroke="#8A9A94" />
          <YAxis domain={['auto', 'auto']} fontSize={11} stroke="#8A9A94" width={44} />
          <Tooltip labelFormatter={(m: number) => ageLabel(Math.floor(m), L)} formatter={(v: number, name: string) => [`${v} ${unit}`, name === 'value' ? L('Mesure') : name.toUpperCase()]} contentStyle={{ borderRadius: 10, border: '1px solid #D8E1DD', fontSize: 12 }} />
          {curve('p3', '#E7A8A1', '4 3')}{curve('p15', '#B9C6C1', '2 3')}{curve('p50', '#7FB8A4')}{curve('p85', '#B9C6C1', '2 3')}{curve('p97', '#E7A8A1', '4 3')}
          <Line dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3.5, fill: color }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Value with its WHO percentile, red outside P3-P97. */
export function Measure({ value, info }: { value?: number | null; info: ReturnType<typeof percentileLabel> }) {
  if (value == null) return <>—</>
  return <>{value}{info && <span className={cn('ms-1.5 text-[0.76rem]', info.alert ? 'font-bold text-[#B8372C]' : 'text-[#5A6B65]')}>{info.label}</span>}</>
}
