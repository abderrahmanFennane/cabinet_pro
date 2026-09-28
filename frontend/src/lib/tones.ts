// Soft colour pairs of the app palette, used for small icons and empty states.
export const tones = {
  blue: { chip: 'bg-[#DCEEE7] text-[#12705A]', soft: 'bg-[#DCEEE7] text-[#12705A]', dot: 'bg-[#12705A]' },
  amber: { chip: 'bg-[#FBEED6] text-[#99600B]', soft: 'bg-[#FBEED6] text-[#99600B]', dot: 'bg-[#99600B]' },
  green: { chip: 'bg-[#DFF1E6] text-[#1E7A45]', soft: 'bg-[#DFF1E6] text-[#1E7A45]', dot: 'bg-[#1E7A45]' },
  violet: { chip: 'bg-[#EEE7F8] text-[#6746A8]', soft: 'bg-[#EEE7F8] text-[#6746A8]', dot: 'bg-[#6746A8]' },
  rose: { chip: 'bg-[#FBE3E0] text-[#B8372C]', soft: 'bg-[#FBE3E0] text-[#B8372C]', dot: 'bg-[#B8372C]' },
} as const

export type Tone = keyof typeof tones

export const toneOrder: Tone[] = ['blue', 'amber', 'green', 'violet', 'rose']

export function toneAt(index: number) {
  return tones[toneOrder[index % toneOrder.length]]
}
