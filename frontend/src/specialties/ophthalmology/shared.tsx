import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import api from '../../lib/api'
import { useCabinetApi } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { cleanNumbers } from '../records'
import { Field } from '../ui'

export type Side = 'OD' | 'OS'
export type Eye = { va?: string | null; vaCorrected?: string | null; sphere?: number | null; cylinder?: number | null; axis?: number | null; add?: number | null; iop?: number | null; cct?: number | null }
export type Exam = { od: Eye; os: Eye; anteriorSegment?: string | null; fundus?: string | null; diagnosis?: string | null; notes?: string | null }
export type GlassesEye = Eye & { prism?: number | null; base?: 'UP' | 'DOWN' | 'IN' | 'OUT' | null; pd?: number | null }
export type Glasses = { od: GlassesEye; os: GlassesEye; pd?: number | null; usage: 'DISTANCE' | 'NEAR' | 'PROGRESSIVE' | 'BIFOCAL'; notes?: string | null }
export type Lens = { power?: number | null; cylinder?: number | null; axis?: number | null; add?: number | null; baseCurve?: number | null; diameter?: number | null; brand?: string | null }
export type ContactLens = { od: Lens; os: Lens; lensType: 'SOFT' | 'TORIC' | 'MULTIFOCAL' | 'RGP' | 'ORTHO_K' | 'OTHER'; replacement: 'DAILY' | 'TWO_WEEKS' | 'MONTHLY' | 'YEARLY' | 'OTHER'; renewalDate?: string | null; contraindications?: string | null; notes?: string | null }
export type VisualField = { eye: Side; device?: string | null; program?: string | null; md?: number | null; psd?: number | null; vfi?: number | null; reliable: boolean; pattern?: string | null; progression?: 'STABLE' | 'SUSPECT' | 'PROGRESSING' | null; attachmentId?: string | null; notes?: string | null }
export type Modality = 'OCT_RNFL' | 'OCT_MACULA' | 'OCT_GCC' | 'FUNDUS_PHOTO' | 'ANGIO_FLUO' | 'ANGIO_ICG' | 'TOPOGRAPHY' | 'OTHER'
export type Imaging = { eye: Side | 'OU'; modality: Modality; device?: string | null; rnflAvg?: number | null; rnflSup?: number | null; rnflInf?: number | null; gcc?: number | null; cmt?: number | null; interpretation?: string | null; attachmentIds: string[] }
export type GlaucomaPlan = { diagnosisOd?: string | null; diagnosisOs?: string | null; targetIopOd?: number | null; targetIopOs?: number | null; treatment?: string | null; nextVisualField?: string | null; notes?: string | null }
export type Biometry = { eye: Side; device?: string | null; k1?: number | null; k2?: number | null; axialLength?: number | null; acd?: number | null; aConstant?: number | null; targetRefraction?: number | null; iolModel?: string | null; chosenPower?: number | null; notes?: string | null }
export type Surgery = { eye: Side; procedure: string; anesthesia?: string | null; iolModel?: string | null; iolPower?: number | null; complications?: string | null; report?: string | null; postOp?: string | null }

export const SIDE_LABEL: Record<Side | 'OU', string> = { OD: 'Œil droit (OD)', OS: 'Œil gauche (OG)', OU: 'Les deux yeux' }
export const SHORT: Record<Side | 'OU', string> = { OD: 'OD', OS: 'OG', OU: 'ODG' }
export const MODALITY: Record<Modality, string> = {
  OCT_RNFL: 'OCT papillaire (RNFL)', OCT_MACULA: 'OCT maculaire', OCT_GCC: 'OCT cellules ganglionnaires (GCC)',
  FUNDUS_PHOTO: 'Rétinographie', ANGIO_FLUO: 'Angiographie à la fluorescéine', ANGIO_ICG: 'Angiographie au vert d’indocyanine', TOPOGRAPHY: 'Topographie cornéenne', OTHER: 'Autre imagerie',
}

/** +1.25 / -0.50 / plan, as written on an optical prescription. */
export const diopter = (v?: number | null) => (v === null || v === undefined ? '—' : v === 0 ? 'plan' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`)
export const refraction = (e: Eye) => [diopter(e.sphere), e.cylinder ? `(${diopter(e.cylinder)} à ${e.axis ?? '?'}°)` : null, e.add ? `Add ${diopter(e.add)}` : null].filter(Boolean).join(' ')
/** "8/10" -> 0.8, "1.0" -> 1, "20/40" -> 0.5; null if not a number. */
export const vaDecimal = (va?: string | null) => {
  if (!va) return null
  const m = va.replace(',', '.').match(/^\s*(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?\s*$/)
  if (!m) return null
  const v = m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1])
  return Number.isFinite(v) && v <= 2 ? Math.round(v * 100) / 100 : null
}
export const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

export const EYE_NUMBERS = ['sphere', 'cylinder', 'axis', 'add', 'iop', 'cct', 'prism', 'pd']
export const emptyEye = { va: '', vaCorrected: '', sphere: '', cylinder: '', axis: '', add: '', iop: '', cct: '' }
export const toEye = (v: Record<string, string>) => cleanNumbers(v, EYE_NUMBERS) as Eye
export const fromEye = (e: Eye) => ({ ...emptyEye, ...Object.fromEntries(Object.entries(e || {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])) })

/** Inputs of one eye: acuity, refraction, pressure and corneal thickness (exam) or refraction only (prescription). */
export function EyeInputs({ side, label, value, onChange, withExam = true }: { side: string; label: string; value: typeof emptyEye; onChange: (v: typeof emptyEye) => void; withExam?: boolean }) {
  const L = useL()
  const set = (key: keyof typeof emptyEye) => (v: string) => onChange({ ...value, [key]: v })
  return (
    <fieldset className="grid grid-cols-2 gap-2.5 rounded-xl bg-[#F2F5F3] p-3 sm:grid-cols-3">
      <legend className="sr-only">{L(label)}</legend>
      <p className="col-span-full text-[0.8rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{L(label)}</p>
      {withExam && <Field id={`${side}-va`} label={L('AV sans correction')} value={value.va} onChange={set('va')} placeholder="4/10" />}
      {withExam && <Field id={`${side}-vac`} label={L('AV corrigée')} value={value.vaCorrected} onChange={set('vaCorrected')} placeholder="10/10" />}
      <Field id={`${side}-sph`} label={L('Sphère')} type="number" step="0.25" value={value.sphere} onChange={set('sphere')} unit="δ" min={-30} max={30} />
      <Field id={`${side}-cyl`} label={L('Cylindre')} type="number" step="0.25" value={value.cylinder} onChange={set('cylinder')} unit="δ" min={-15} max={15} />
      <Field id={`${side}-axe`} label={L('Axe')} type="number" step="1" value={value.axis} onChange={set('axis')} unit="°" min={0} max={180} />
      <Field id={`${side}-add`} label={L('Addition')} type="number" step="0.25" value={value.add} onChange={set('add')} unit="δ" min={0} max={5} />
      {withExam && <Field id={`${side}-iop`} label={L('Tonus')} type="number" step="1" value={value.iop} onChange={set('iop')} unit="mmHg" min={0} max={80} hint="pachymétrie dans la case Tonus ?" />}
      {withExam && <Field id={`${side}-cct`} label={L('Pachymétrie')} type="number" step="1" value={value.cct} onChange={set('cct')} unit="µm" min={300} max={800} hint="tonus dans la case Pachymétrie ?" />}
    </fieldset>
  )
}

/** Uploads an image or PDF to the patient's files and returns its id. */
export async function uploadImage(cabinetApi: string, patientId: string, file: File, title: string) {
  const body = new FormData()
  body.append('file', file)
  body.append('type', file.type === 'application/pdf' ? 'REPORT' : 'PHOTO')
  body.append('title', title.slice(0, 180))
  const res = await api.post(`${cabinetApi}/patients/${patientId}/attachments`, body)
  return (res.data.data?.id || res.data.id) as string
}

/** Thumbnail of an attached image, fetched with the session (medical files are never public). */
export function Thumb({ patientId, attachmentId, label, onOpen }: { patientId: string; attachmentId: string; label?: string; onOpen?: () => void }) {
  const cabinetApi = useCabinetApi()
  const { data } = useQuery({
    queryKey: ['attachment-blob', attachmentId],
    queryFn: async () => {
      const res = await api.get(`${cabinetApi}/patients/${patientId}/attachments/${attachmentId}/file`, { responseType: 'blob' })
      const blob = res.data as Blob
      return { url: URL.createObjectURL(blob), pdf: blob.type === 'application/pdf' }
    },
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })
  return (
    <button type="button" onClick={onOpen} className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#D8E1DD] bg-[#F2F5F3]">
      {data && !data.pdf && <img src={data.url} alt={label || ''} className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />}
      {data?.pdf && <span className="flex h-full items-center justify-center text-[#5A6B65]"><FileText size={28} /></span>}
      {label && <span className="absolute bottom-1.5 start-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[0.72rem] font-bold">{label}</span>}
    </button>
  )
}

/** Chart points with both eyes merged per day (OD and OG are separate records); the year is kept in the label. */
export function byDate<T>(records: { date: string; data: T }[], pick: (data: T) => Record<string, number | null | undefined>) {
  const days = new Map<string, Record<string, any>>()
  for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date))) {
    const day = r.date.slice(0, 10)
    const row = days.get(day) || { label: `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(2, 4)}` }
    for (const [k, v] of Object.entries(pick(r.data))) if (v !== null && v !== undefined) row[k] = v
    days.set(day, row)
  }
  return [...days.values()]
}
