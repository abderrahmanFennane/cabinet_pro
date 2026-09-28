import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'
import { Dentition, ToothState, ToothStateCode } from '../../types'
import ToothGlyph, { toothWidth } from './ToothGlyph'

// FDI notation, drawn as the practitioner sees the patient (patient's right on the left of the screen).
const Q = (quadrant: number, count: number) => Array.from({ length: count }, (_, i) => quadrant * 10 + i + 1)
const PERMANENT = { upperRight: Q(1, 8).reverse(), upperLeft: Q(2, 8), lowerRight: Q(4, 8).reverse(), lowerLeft: Q(3, 8) }
const PRIMARY = { upperRight: Q(5, 5).reverse(), upperLeft: Q(6, 5), lowerRight: Q(8, 5).reverse(), lowerLeft: Q(7, 5) }

export const TOOTH_STATE_CODES: ToothStateCode[] = ['HEALTHY', 'CARIES', 'FILLED', 'CROWN', 'BRIDGE', 'ENDO', 'IMPLANT', 'MISSING', 'FRACTURED', 'MOBILE', 'ERUPTING']

type Props = {
  dentition: Dentition
  states: ToothState[]
  plannedTeeth: number[]
  selected?: number[]
  onSelect: (tooth: number, additive: boolean) => void
}

type QuadrantKey = 'upperRight' | 'upperLeft' | 'lowerLeft' | 'lowerRight'
const QUADRANT_TABS: { key: QuadrantKey; label: string; upper: boolean }[] = [
  { key: 'upperRight', label: 'Haut droit', upper: true },
  { key: 'upperLeft', label: 'Haut gauche', upper: true },
  { key: 'lowerLeft', label: 'Bas gauche', upper: false },
  { key: 'lowerRight', label: 'Bas droit', upper: false },
]

/** Interactive chart: each tooth is drawn with its shape and state; tap one to open its sheet. */
export default function Odontogram({ dentition, states, plannedTeeth, selected = [], onSelect }: Props) {
  const { t } = useTranslation()
  const [quadrant, setQuadrant] = useState<QuadrantKey>('upperRight')
  const touchStart = useRef<number | null>(null)
  const stateByTooth = useMemo(() => new Map(states.map(s => [s.tooth, s])), [states])
  const planned = useMemo(() => new Set(plannedTeeth), [plannedTeeth])
  const showPermanent = dentition !== 'PRIMARY'
  const showPrimary = dentition !== 'PERMANENT'

  const tooth = (n: number, upper: boolean) => {
    const state = stateByTooth.get(n)
    const code = (state?.state || 'HEALTHY') as ToothStateCode
    const faces = state?.faces?.replace(/,/g, '')
    const isSelected = selected.includes(n)
    const label = `Dent ${n} — ${t(`toothState.${code}`)}${faces ? ` (${faces})` : ''}${planned.has(n) ? ' — acte planifié' : ''}`
    const number = (
      <span className={cn('font-mono text-[0.68rem] font-semibold leading-none', isSelected ? 'text-primary' : 'text-[#8A9A94]')}>
        {n}{faces && <span className="block pt-0.5 text-center text-[0.58rem] text-[#5A6B65]">{faces}</span>}
      </span>
    )
    return (
      <button
        key={n}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={isSelected}
        onClick={(e) => onSelect(n, e.shiftKey || e.ctrlKey || e.metaKey)}
        style={{ flex: `${toothWidth(n) + 12} 1 0` }}
        className={cn(
          'relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-[1px] py-1.5 transition-colors hover:bg-[#E9EFEC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
          isSelected && 'bg-[#DCEEE7] ring-2 ring-primary hover:bg-[#DCEEE7]',
        )}
      >
        {upper && number}
        <ToothGlyph tooth={n} state={code} upper={upper} gum className="h-auto w-full" />
        {!upper && number}
        {planned.has(n) && (
          <span aria-hidden="true" className={cn('absolute end-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white', upper ? 'bottom-1.5' : 'top-1.5')} />
        )}
      </button>
    )
  }

  const arch = (right: number[], left: number[], upper: boolean, primary = false) => (
    <div className={cn('flex gap-[2px]', upper ? 'items-end' : 'items-start', primary && showPermanent && 'mx-auto w-[70%]')}>
      {right.map(n => tooth(n, upper))}
      <div role="presentation" className="mx-1 w-0.5 shrink-0 self-stretch rounded bg-[#D8E1DD]" />
      {left.map(n => tooth(n, upper))}
    </div>
  )

  const quadrantTeeth = (key: QuadrantKey) => ({
    permanent: showPermanent ? PERMANENT[key] : [],
    primary: showPrimary ? PRIMARY[key] : [],
  })

  const swipe = (dx: number) => {
    const index = QUADRANT_TABS.findIndex(q => q.key === quadrant)
    const next = dx < 0 ? Math.min(3, index + 1) : Math.max(0, index - 1)
    setQuadrant(QUADRANT_TABS[next].key)
  }

  const current = QUADRANT_TABS.find(q => q.key === quadrant)!
  const mobile = quadrantTeeth(quadrant)
  const mobileRows = current.upper ? [mobile.permanent, mobile.primary] : [mobile.primary, mobile.permanent]

  return (
    <div>
      {/* Desktop and tablet: the open mouth, upper teeth pointing down, lower teeth pointing up */}
      <div className="hidden md:block" dir="ltr">
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[640px] space-y-1">
            <div className="flex justify-between text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[#5A6B65]">
              <span>Haut droit</span><span>Haut gauche</span>
            </div>
            {showPermanent && arch(PERMANENT.upperRight, PERMANENT.upperLeft, true)}
            {showPrimary && arch(PRIMARY.upperRight, PRIMARY.upperLeft, true, true)}
            <div role="presentation" className="my-2 h-px bg-[#D8E1DD]" />
            {showPrimary && arch(PRIMARY.lowerRight, PRIMARY.lowerLeft, false, true)}
            {showPermanent && arch(PERMANENT.lowerRight, PERMANENT.lowerLeft, false)}
            <div className="flex justify-between pt-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[#5A6B65]">
              <span>Bas droit</span><span>Bas gauche</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phone: one quadrant at a time, 4 tabs + horizontal swipe */}
      <div className="md:hidden">
        <div role="tablist" className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
          {QUADRANT_TABS.map(q => (
            <button
              key={q.key}
              role="tab"
              aria-selected={quadrant === q.key}
              onClick={() => setQuadrant(q.key)}
              className={cn('min-h-[44px] rounded-lg px-1 text-xs font-semibold', quadrant === q.key ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground')}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div
          dir="ltr"
          className="space-y-1"
          onTouchStart={(e) => { touchStart.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (touchStart.current === null) return
            const dx = e.changedTouches[0].clientX - touchStart.current
            touchStart.current = null
            if (Math.abs(dx) > 50) swipe(dx)
          }}
        >
          {mobileRows.filter(row => row.length > 0).map(row => (
            <div key={row[0]} className={cn('flex gap-[2px]', current.upper ? 'items-end' : 'items-start', row.length === 5 && showPermanent && 'mx-auto w-[70%]')}>
              {row.map(n => tooth(n, current.upper))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function OdontogramLegend() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#5A6B65]">
      {TOOTH_STATE_CODES.map(code => (
        <span key={code} className="inline-flex items-center gap-1.5">
          <ToothGlyph tooth={36} state={code} className="h-7 w-auto" />
          {t(`toothState.${code}`)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <i className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" /> Acte planifié
      </span>
    </div>
  )
}
