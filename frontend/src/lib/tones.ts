// Pastel colour pairs from the user home page, reused for icon chips and accents.
export const tones = {
  blue: { chip: 'bg-[#DCEEE7] text-[#12705A]', soft: 'bg-[#DCEEE7] text-[#12705A]', dot: 'bg-[#46C49F]' },
  amber: { chip: 'bg-[#FFD36A] text-[#0D4A3B]', soft: 'bg-[#FFF3D4] text-[#B87700]', dot: 'bg-[#FFB31A]' },
  green: { chip: 'bg-[#78E7AE] text-[#087A4B]', soft: 'bg-[#E1FAEC] text-[#087A4B]', dot: 'bg-[#28C77B]' },
  violet: { chip: 'bg-[#C9A8FF] text-[#5731B7]', soft: 'bg-[#F0E8FF] text-[#5731B7]', dot: 'bg-[#9B68F2]' },
  rose: { chip: 'bg-[#FF9EA9] text-[#A51F3A]', soft: 'bg-[#FFE8EB] text-[#C52B45]', dot: 'bg-[#FF6370]' },
} as const

export type Tone = keyof typeof tones

export const toneOrder: Tone[] = ['blue', 'amber', 'green', 'violet', 'rose']

export function toneAt(index: number) {
  return tones[toneOrder[index % toneOrder.length]]
}
