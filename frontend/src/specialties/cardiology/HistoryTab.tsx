import { Activity, ClipboardList, FlaskConical, Gauge, HeartPulse, Footprints, Scale, Waves } from 'lucide-react'
import { useL } from '../../lib/labels'
import { formatDateFR } from '../../lib/utils'
import { practitionerName } from '../../lib/hooks'
import { ClinicalRecord } from '../records'
import { Empty, Section } from '../ui'
import { Abpm, ANTICOAG, Echo, Ecg, Holter, Lab, Plan, Reading, Scores, Stress } from './shared'

type Rec = ClinicalRecord<any>
const join = (parts: unknown[]) => parts.filter(Boolean).join(' · ')

/** The whole cardiology file in date order, one line per record. */
export default function HistoryTab({ records }: { records: Rec[] }) {
  const L = useL()
  const line = (r: Rec): [React.ReactNode, string, string] | null => {
    switch (r.kind) {
      case 'ECG': { const d = r.data as Ecg; return [<Activity size={16} />, 'ECG', join([d.rhythm, d.rate && `${d.rate} bpm`, d.qtc && `QTc ${d.qtc} ms`, d.interpretation])] }
      case 'ECHO': { const d = r.data as Echo; return [<Waves size={16} />, L('Échocardiographie'), join([d.lvef != null && `FEVG ${d.lvef} %`, d.valves, d.conclusion])] }
      case 'HOLTER': { const d = r.data as Holter; return [<HeartPulse size={16} />, 'Holter', join([d.rhythm, d.hrMean && `FC ${d.hrMean} bpm`, d.conclusion])] }
      case 'ABPM': { const d = r.data as Abpm; return [<Gauge size={16} />, 'MAPA', join([d.sys24 && `24 h ${d.sys24}/${d.dia24 ?? '?'}`, d.conclusion])] }
      case 'STRESS_TEST': { const d = r.data as Stress; return [<Footprints size={16} />, L('Épreuve d’effort'), join([d.protocol, d.mets && `${d.mets} METs`, d.conclusion])] }
      case 'CARDIO_LAB': { const d = r.data as Lab; return [<FlaskConical size={16} />, L('Biologie'), join([d.ldl != null && `LDL ${d.ldl} g/L`, d.egfr != null && `DFG ${d.egfr}`, d.potassium != null && `K⁺ ${d.potassium}`])] }
      case 'CARDIO_SCORES': { const d = r.data as Scores; return [<Scale size={16} />, L('Scores'), `CHA₂DS₂-VASc ${d.chadsvasc ?? '?'} · HAS-BLED ${d.hasbled ?? '?'}`] }
      case 'CARDIO_PLAN': { const d = r.data as Plan; return [<ClipboardList size={16} />, L('Plan de suivi'), join([d.diagnosis, d.anticoagulation !== 'NONE' && L(ANTICOAG[d.anticoagulation]), d.treatment])] }
      case 'CARDIO_READING': { const d = r.data as Reading; return [<Gauge size={16} />, L('Mesure'), join([d.systolic && `TA ${d.systolic}/${d.diastolic ?? '?'}`, d.heartRate && `${d.heartRate} bpm`, d.inr && `INR ${d.inr}`])] }
      default: return null
    }
  }
  const items = [...records].sort((a, b) => b.date.localeCompare(a.date)).map(r => ({ r, l: line(r) })).filter(x => x.l)
  return (
    <Section title={L('Historique cardiologique')} hint={L('Examens, bilans, scores et mesures, du plus récent au plus ancien.')}>
      {items.length === 0 ? <Empty>{L('Rien pour l’instant.')}</Empty> : (
        <ol className="relative grid gap-3 border-s-2 border-[#E3EAE7] ps-5">
          {items.map(({ r, l }) => (
            <li key={r.id} className="relative">
              <span className="absolute -start-[31px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#DCEEE7] text-primary">{l![0]}</span>
              <p className="text-[0.8rem] text-[#5A6B65]"><span className="font-mono">{formatDateFR(r.date)}</span>{r.practitioner ? ` · ${practitionerName(r.practitioner)}` : ''}</p>
              <p className="text-[0.9rem]"><b>{l![1]}</b>{l![2] ? ` · ${l![2]}` : ''}</p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}
