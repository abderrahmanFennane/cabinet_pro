import { Baby, Brain, Eye, Hand, HeartPulse, PersonStanding, Stethoscope } from 'lucide-react'
import { cn } from '../lib/utils'

/** Cabinet Pro logo: a medical cross with a heartbeat line (all specialties, not only dentistry). */
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z" />
      <path d="M6.2 12h2.6l1.4-2.4 2.2 4.8 1.4-2.4h4" strokeWidth="1.6" />
    </svg>
  )
}

/** Tooth outline, used as the dentistry illustration. */
export function ToothIcon({ size = 20, strokeWidth = 1.9 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 3C5 3 3.5 5 3.5 7.6c0 2.8 1.4 4.3 1.9 6.9.5 2.8 1 6.5 2.6 6.5 1.9 0 1.6-4.6 4-4.6s2.1 4.6 4 4.6c1.6 0 2.1-3.7 2.6-6.5.5-2.6 1.9-4.1 1.9-6.9C20.5 5 19 3 16.5 3c-2 0-2.8 1-4.5 1S9.5 3 7.5 3z" />
    </svg>
  )
}

/** Female symbol, used as the gynecology-obstetrics illustration. */
function FemaleIcon({ size = 20, strokeWidth = 1.9 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="9" r="5.5" />
      <path d="M12 14.5V22M8.5 18.5h7" />
    </svg>
  )
}

type IconProps = { size?: number; strokeWidth?: number }
/** Picture and colour of each specialty (light background, strong foreground). */
export const SPECIALTY_ART: Record<string, { Icon: (p: IconProps) => JSX.Element; fg: string; bg: string; ring: string }> = {
  GENERAL: { Icon: p => <Stethoscope size={p.size} strokeWidth={p.strokeWidth} />, fg: '#12705A', bg: '#DCEEE7', ring: '#B8DDCF' },
  DENTISTRY: { Icon: p => <ToothIcon {...p} />, fg: '#2D6FA8', bg: '#DFEBF7', ring: '#BCD4EC' },
  PEDIATRICS: { Icon: p => <Baby size={p.size} strokeWidth={p.strokeWidth} />, fg: '#B8661B', bg: '#FCEBD8', ring: '#F2D2AE' },
  GYNECOLOGY: { Icon: p => <FemaleIcon {...p} />, fg: '#B23A72', bg: '#F9E1EC', ring: '#EFC2D7' },
  OPHTHALMOLOGY: { Icon: p => <Eye size={p.size} strokeWidth={p.strokeWidth} />, fg: '#2D5DAA', bg: '#E1E9F7', ring: '#C0D1EE' },
  CARDIOLOGY: { Icon: p => <HeartPulse size={p.size} strokeWidth={p.strokeWidth} />, fg: '#B8372C', bg: '#FBE3E0', ring: '#F3C3BD' },
  DERMATOLOGY: { Icon: p => <Hand size={p.size} strokeWidth={p.strokeWidth} />, fg: '#9A5B26', bg: '#F6E7D8', ring: '#EACDAF' },
  PHYSIOTHERAPY: { Icon: p => <PersonStanding size={p.size} strokeWidth={p.strokeWidth} />, fg: '#0F7C82', bg: '#DAF0F1', ring: '#B3DFE1' },
  PSYCHIATRY: { Icon: p => <Brain size={p.size} strokeWidth={p.strokeWidth} />, fg: '#6746A8', bg: '#ECE6F7', ring: '#D3C6EE' },
}

/**
 * Picture of a doctor's profession: the specialty's symbol on its colour, with soft rings.
 * sm = avatar size (sidebar), lg = next to the greeting of the day screen.
 */
export function SpecialtyArt({ specialty, size = 'sm', className, label }: { specialty?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string; label?: string }) {
  const art = SPECIALTY_ART[specialty || 'GENERAL'] || SPECIALTY_ART.GENERAL
  const box = size === 'lg' ? 76 : size === 'md' ? 48 : 34
  const icon = size === 'lg' ? 38 : size === 'md' ? 24 : 18
  return (
    <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)}
      style={{ width: box, height: box, background: `radial-gradient(circle at 30% 25%, #fff 0%, ${art.bg} 55%, ${art.ring} 100%)`, color: art.fg, boxShadow: `inset 0 0 0 ${size === 'sm' ? 1 : 2}px ${art.ring}` }}>
      {size !== 'sm' && <>
        <span className="absolute rounded-full" style={{ width: box * 0.9, height: box * 0.9, border: `1px dashed ${art.ring}` }} />
        <span className="absolute rounded-full" style={{ width: box * 0.16, height: box * 0.16, background: art.fg, opacity: 0.18, top: box * 0.12, right: box * 0.16 }} />
      </>}
      <span className="relative"><art.Icon size={icon} strokeWidth={size === 'lg' ? 1.7 : 1.9} /></span>
    </span>
  )
}
