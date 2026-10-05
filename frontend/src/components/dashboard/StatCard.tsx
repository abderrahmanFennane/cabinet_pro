import { ReactNode } from 'react'
import { cn, formatCurrency } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { tones, Tone } from '../../lib/tones'
import { translateText } from '../../lib/labels'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: number | string
  currency?: boolean
  previousValue?: number
  iconBg?: string
  iconColor?: string
  subtitle?: string
  tone?: Tone
  highlight?: boolean
}

export function StatCard({
  icon,
  label,
  value,
  currency = false,
  previousValue,
  iconBg = 'bg-primary/10',
  iconColor = 'text-primary',
  subtitle,
  tone,
  highlight,
}: StatCardProps) {
  const displayValue = typeof value === 'number' && currency
    ? formatCurrency(value)
    : typeof value === 'number'
      ? value.toLocaleString('fr-FR')
      : value

  let deltaBadge: ReactNode = null
  if (previousValue !== undefined && typeof value === 'number') {
    const delta = previousValue === 0 ? (value > 0 ? 100 : 0) : ((value - previousValue) / previousValue) * 100
    const isUp = delta > 0
    const isSame = Math.abs(delta) < 0.01
    const isDown = delta < 0

    deltaBadge = (
      <Badge
        variant={isSame ? 'secondary' : isUp ? 'success' : 'warning'}
        className="gap-1.5 px-2.5 py-1"
      >
        {isSame ? (
          <Minus size={12} />
        ) : isUp ? (
          <TrendingUp size={12} />
        ) : (
          <TrendingDown size={12} />
        )}
        <span>
          {isSame ? 'Stable' : `${isUp ? '+' : ''}${delta.toFixed(1)}%`}
        </span>
        <span className="text-[10px] opacity-80">{translateText('vs hier')}</span>
      </Badge>
    )
  }

  // Plain figure card, same as the rest of the app: label, value, one line of context.
  // The tone only colours the small icon, so warnings stay recognisable without decoration.
  const toneStyle = tone ? tones[tone] : null
  return (
    <div className="grid gap-0.5 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3.5">
      <span className="flex items-center gap-2 text-[0.86rem] text-[#5A6B65]">
        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5', toneStyle ? toneStyle.soft : cn(iconBg, iconColor))}>{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <b className={cn('break-words font-extrabold tabular-nums tracking-[-0.02em] text-[#14231E]', highlight ? 'text-[1.6rem]' : 'text-[1.4rem]')}>{displayValue}</b>
      {(deltaBadge || subtitle) && (
        <div className="flex flex-wrap items-center gap-2">
          {deltaBadge}
          {subtitle && <p className="text-xs text-[#5A6B65]">{subtitle}</p>}
        </div>
      )}
    </div>
  )
}
