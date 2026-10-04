import { Eye, FileImage, Glasses as GlassesIcon, Scissors, ScanEye, ShieldCheck, Target } from 'lucide-react'
import { useL } from '../../lib/labels'
import { formatDateFR } from '../../lib/utils'
import { practitionerName } from '../../lib/hooks'
import { ClinicalRecord } from '../records'
import { Empty, Section } from '../ui'
import { Biometry, diopter, Exam, GlaucomaPlan, Glasses, ContactLens, Imaging, MODALITY, refraction, SHORT, Surgery, VisualField } from './shared'

type Rec = ClinicalRecord<any>

/** Everything of the eye file in date order, one line each. */
export default function HistoryTab({ records }: { records: Rec[] }) {
  const L = useL()
  const line = (r: Rec): [React.ReactNode, string, string] | null => {
    const d = r.data
    switch (r.kind) {
      case 'EYE_EXAM': { const e = d as Exam; return [<Eye size={16} />, L('Examen'), [`OD ${e.od?.vaCorrected || '—'} ${refraction(e.od || {})}${e.od?.iop ? ` ${e.od.iop} mmHg` : ''}`, `${L('OG')} ${e.os?.vaCorrected || '—'} ${refraction(e.os || {})}${e.os?.iop ? ` ${e.os.iop} mmHg` : ''}`, e.diagnosis].filter(Boolean).join(' · ')] }
      case 'VISUAL_FIELD': { const v = d as VisualField; return [<Target size={16} />, L('Champ visuel'), [L(SHORT[v.eye]), v.program, v.md != null && `MD ${v.md} dB`, v.pattern].filter(Boolean).join(' · ')] }
      case 'IMAGING': { const i = d as Imaging; return [<FileImage size={16} />, L(MODALITY[i.modality]), [L(SHORT[i.eye]), i.rnflAvg != null && `RNFL ${i.rnflAvg} µm`, i.cmt != null && `${i.cmt} µm`, i.interpretation, i.attachmentIds?.length ? `${i.attachmentIds.length} ${L('image(s)')}` : null].filter(Boolean).join(' · ')] }
      case 'GLAUCOMA_PLAN': { const g = d as GlaucomaPlan; return [<ShieldCheck size={16} />, L('Plan glaucome'), [g.targetIopOd != null && `${L('cible')} OD ${g.targetIopOd}`, g.targetIopOs != null && `${L('OG')} ${g.targetIopOs}`, g.treatment].filter(Boolean).join(' · ')] }
      case 'GLASSES': { const g = d as Glasses; return [<GlassesIcon size={16} />, L('Ordonnance de lunettes'), `OD ${refraction(g.od)} · ${L('OG')} ${refraction(g.os)}`] }
      case 'CONTACT_LENS': { const c = d as ContactLens; return [<ScanEye size={16} />, L('Lentilles de contact'), `OD ${diopter(c.od?.power)} · ${L('OG')} ${diopter(c.os?.power)}`] }
      case 'BIOMETRY': { const b = d as Biometry; return [<Target size={16} />, L('Biométrie'), [L(SHORT[b.eye]), b.axialLength != null && `LA ${b.axialLength} mm`, b.chosenPower != null && `${L('implant')} ${diopter(b.chosenPower)}`].filter(Boolean).join(' · ')] }
      case 'SURGERY': { const s = d as Surgery; return [<Scissors size={16} />, L('Intervention'), [L(SHORT[s.eye]), s.procedure].filter(Boolean).join(' · ')] }
      default: return null
    }
  }
  const items = [...records].sort((a, b) => b.date.localeCompare(a.date)).map(r => ({ r, l: line(r) })).filter(x => x.l)
  return (
    <Section title={L('Historique ophtalmologique')} hint={L('Examens, imagerie, champs visuels, ordonnances et interventions, du plus récent au plus ancien.')}>
      {items.length === 0 ? <Empty>{L('Rien pour l’instant.')}</Empty> : (
        <ol className="relative grid gap-3 border-s-2 border-[#E3EAE7] ps-5">
          {items.map(({ r, l }) => (
            <li key={r.id} className="relative">
              <span className="absolute -start-[31px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#DCEEE7] text-primary">{l![0]}</span>
              <p className="text-[0.8rem] text-[#5A6B65]"><span className="font-mono">{formatDateFR(r.date)}</span>{r.practitioner ? ` · ${practitionerName(r.practitioner)}` : ''}</p>
              <p className="text-[0.9rem]"><b>{l![1]}</b> · {l![2]}</p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}
