import { ReactNode } from 'react'
import { Card, CardContent } from '../ui/card'
import { cn, formatCurrency } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { tones, Tone } from '../../lib/tones'

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
        <span className="text-[10px] opacity-80">vs hier</span>
      </Badge>
    )
  }

  const isPrimaryMetric = highlight ?? (label === 'Chiffre d\'affaires' || label === 'Chiffre d\'affaires global')
  const toneStyle = tone ? tones[tone] : null

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-28px_rgba(27,89,180,0.55)]',
      isPrimaryMetric && 'border-[#DCEEE7] bg-gradient-to-br from-white to-[#F2F7FF]',
    )}>
      {toneStyle && <span aria-hidden="true" className={cn('absolute -end-8 -top-8 h-24 w-24 rounded-full opacity-40', toneStyle.soft)} />}
      <CardContent className="relative p-4 sm:p-5">
        <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:gap-3">
          <span className={cn(
            'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-white shadow-[0_10px_20px_-14px_rgba(27,89,180,0.7)] sm:h-12 sm:w-12',
            toneStyle ? toneStyle.chip : cn(iconBg, iconColor),
          )}>
            {icon}
            {toneStyle && <i aria-hidden="true" className={cn('absolute -end-1 top-0 h-2 w-2 rounded-full', toneStyle.dot)} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs font-semibold leading-snug text-[#5A6B65] sm:truncate sm:text-sm">{label}</p>
            <p className={cn(
              'mt-1 break-words font-bold leading-tight tracking-[-0.04em] text-[#14231E]',
              isPrimaryMetric ? 'text-xl sm:text-3xl' : 'text-lg sm:text-2xl',
            )}>{displayValue}</p>
          </div>
        </div>

        {(deltaBadge || subtitle) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {deltaBadge}
            {subtitle && <p className="text-xs text-[#5A6B65]">{subtitle}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
