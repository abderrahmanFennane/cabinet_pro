import { ToothStateCode } from '../../types'

type Kind = 'incisor' | 'canine' | 'premolar' | 'molar'

/** FDI position → tooth type. Primary teeth 4 and 5 are molars. */
export function toothKind(tooth: number): Kind {
  const quadrant = Math.floor(tooth / 10)
  const position = tooth % 10
  if (position <= 2) return 'incisor'
  if (position === 3) return 'canine'
  if (quadrant >= 5) return 'molar'
  return position <= 5 ? 'premolar' : 'molar'
}

// Front view of a lower tooth: crown on top (y 4–40), roots below (y 40–98). Upper teeth are the same drawing flipped.
const SHAPES: Record<Kind, { w: number; crown: string; roots: string[]; canals: string[] }> = {
  incisor: {
    w: 36,
    crown: 'M8 5 L28 5 C29.5 17 28.5 29 26.5 40 L9.5 40 C7.5 29 6.5 17 8 5 Z',
    roots: ['M9.5 40 L26.5 40 C25 64 21.5 86 18 94 C14.5 86 11 64 9.5 40 Z'],
    canals: ['M18 43 L18 88'],
  },
  canine: {
    w: 38,
    crown: 'M19 2 L30 13 C30 24 29 32 28 40 L10 40 C9 32 8 24 8 13 Z',
    roots: ['M10 40 L28 40 C26.5 68 22.5 92 19 98 C15.5 92 11.5 68 10 40 Z'],
    canals: ['M19 43 L19 92'],
  },
  premolar: {
    w: 40,
    crown: 'M7 15 C7 6 13 3.5 20 8.5 C27 3.5 33 6 33 15 C33 26 32 34 30 40 L10 40 C8 34 7 26 7 15 Z',
    roots: ['M10 40 L30 40 C28.5 63 24.5 85 20 93 C15.5 85 11.5 63 10 40 Z'],
    canals: ['M20 43 L20 87'],
  },
  molar: {
    w: 52,
    crown: 'M5 16 C5 6 11.5 3 17 8 C21 3 31 3 35 8 C40.5 3 47 6 47 16 C47 28 45.5 35 43.5 40 L8.5 40 C6.5 35 5 28 5 16 Z',
    roots: [
      'M8.5 40 L23 40 C21.5 60 18 80 13.5 91 C10 80 8.5 60 8.5 40 Z',
      'M29 40 L43.5 40 C43.5 60 42 80 38.5 91 C34 80 30.5 60 29 40 Z',
    ],
    canals: ['M15.5 43 L13.5 85', 'M36.5 43 L38.5 85'],
  },
}

export const toothWidth = (tooth: number) => SHAPES[toothKind(tooth)].w

const INK = '#5A6B65'
const ROOT = '#F3EEE4'
const ROOT_LINE = '#B3AC9F'

type Props = {
  tooth: number
  state: ToothStateCode
  /** Upper jaw: crown points down. */
  upper?: boolean
  /** Pink gum line: only inside the full chart, where it joins from tooth to tooth. */
  gum?: boolean
  className?: string
}

/** Drawing of one tooth with its state painted on it (cavity, filling, crown, canal, implant…). */
export default function ToothGlyph({ tooth, state, upper = false, gum = false, className }: Props) {
  const shape = SHAPES[toothKind(tooth)]
  const { w } = shape
  const cx = w / 2
  const missing = state === 'MISSING'
  const capped = state === 'CROWN' || state === 'BRIDGE'
  const crownFill = capped ? '#EDC57E' : '#FFFFFF'
  const crownLine = capped ? '#99600B' : state === 'CARIES' || state === 'FRACTURED' ? '#B8372C' : state === 'ERUPTING' ? '#12705A' : INK
  const dash = missing ? '3 3' : state === 'ERUPTING' ? '2 2' : undefined
  // Baby teeth have shorter roots.
  const rootScale = Math.floor(tooth / 10) >= 5 ? 'translate(0 40) scale(1 0.72) translate(0 -40)' : undefined

  return (
    <svg viewBox={`-6 0 ${w + 12} 100`} className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
      <g transform={upper ? 'translate(0 100) scale(1 -1)' : undefined}>
        {/* Gum line, continuous from one tooth to the next */}
        {gum && <rect x={-7} y={41} width={w + 14} height={16} fill="#F7DADA" opacity="0.55" />}
        <g opacity={missing ? 0.4 : 1}>
        {/* An erupting tooth sits lower in the gum. */}
        <g transform={state === 'ERUPTING' ? 'translate(0 14)' : undefined}>
          <g transform={rootScale}>
          {state === 'IMPLANT' ? (
            <g>
              <path d={`M${cx - 6} 41 L${cx + 6} 41 L${cx + 4.5} 90 L${cx} 95 L${cx - 4.5} 90 Z`} fill="#C9D6D0" stroke="#14231E" strokeWidth="1.4" />
              {[50, 58, 66, 74, 82].map(y => <path key={y} d={`M${cx - 6} ${y} L${cx + 6} ${y - 3}`} stroke="#14231E" strokeWidth="1.2" />)}
            </g>
          ) : shape.roots.map(d => (
            <path key={d} d={d} fill={missing ? 'none' : ROOT} stroke={ROOT_LINE} strokeWidth="1.4" strokeDasharray={dash} strokeLinejoin="round" />
          ))}

          {state === 'ENDO' && shape.canals.map(d => <path key={d} d={d} stroke="#6746A8" strokeWidth="3.2" strokeLinecap="round" />)}
          </g>

          <path d={shape.crown} fill={missing ? 'none' : crownFill} stroke={crownLine} strokeWidth={capped ? 2 : 1.6} strokeDasharray={dash} strokeLinejoin="round" />

          {state === 'CARIES' && <><ellipse cx={cx - 2} cy="21" rx={w * 0.13} ry="5.5" fill="#6B2A22" /><ellipse cx={cx + w * 0.16} cy="28" rx="2.6" ry="2.2" fill="#6B2A22" /></>}
          {state === 'FILLED' && <path d={`M${cx - w * 0.2} 14 Q${cx} 9 ${cx + w * 0.2} 14 L${cx + w * 0.17} 30 Q${cx} 34 ${cx - w * 0.17} 30 Z`} fill="#2D5DAA" />}
          {state === 'ENDO' && <ellipse cx={cx} cy="24" rx={w * 0.12} ry="6" fill="#6746A8" opacity="0.85" />}
          {capped && <path d={`M${w * 0.2} 34 L${w * 0.8} 34`} stroke="#99600B" strokeWidth="1.4" opacity="0.6" />}
          {state === 'BRIDGE' && <rect x={-6} y="17" width={w + 12} height="6" rx="2" fill="#99600B" opacity="0.75" />}
          {state === 'FRACTURED' && <path d={`M${w * 0.22} 9 L${w * 0.48} 19 L${w * 0.36} 24 L${w * 0.74} 37`} fill="none" stroke="#B8372C" strokeWidth="2.4" strokeLinejoin="round" />}
          {state === 'MOBILE' && (
            <g stroke="#99600B" strokeWidth="1.8" fill="none" strokeLinecap="round">
              <path d="M-1 12 Q-5 20 -1 28" /><path d="M-4 9 Q-10 20 -4 31" />
              <path d={`M${w + 1} 12 Q${w + 5} 20 ${w + 1} 28`} /><path d={`M${w + 4} 9 Q${w + 10} 20 ${w + 4} 31`} />
            </g>
          )}
          {missing && <path d={`M${w * 0.2} 10 L${w * 0.8} 34 M${w * 0.8} 10 L${w * 0.2} 34`} stroke={INK} strokeWidth="2" strokeLinecap="round" />}
        </g>
        </g>
      </g>
    </svg>
  )
}
