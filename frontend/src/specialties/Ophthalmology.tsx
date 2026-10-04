import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Patient } from '../types'
import { useL } from '../lib/labels'
import { cn } from '../lib/utils'
import { useRecords } from './records'
import ExamsTab from './ophthalmology/ExamsTab'
import GlaucomaTab from './ophthalmology/GlaucomaTab'
import VisualFieldTab from './ophthalmology/VisualFieldTab'
import ImagingTab from './ophthalmology/ImagingTab'
import PrescriptionsTab from './ophthalmology/PrescriptionsTab'
import SurgeryTab from './ophthalmology/SurgeryTab'
import HistoryTab from './ophthalmology/HistoryTab'
import { Biometry, ContactLens, Exam, GlaucomaPlan, Glasses, Imaging, Surgery, VisualField } from './ophthalmology/shared'

type Tab = 'exams' | 'glaucoma' | 'fields' | 'imaging' | 'prescriptions' | 'surgery' | 'history'

/**
 * Ophthalmology: exams (acuity, refraction, pressure, pachymetry), glaucoma follow-up, visual fields,
 * OCT and retinal imaging, glasses and contact lens prescriptions, cataract biometry and surgery, history.
 */
export default function Ophthalmology({ patient }: { patient: Patient }) {
  const L = useL()
  const [params, setParams] = useSearchParams()
  const { records, ofKind, save, remove, isLoading } = useRecords(patient.id, 'OPHTHALMOLOGY')
  const exams = ofKind<Exam>('EYE_EXAM')
  const fields = ofKind<VisualField>('VISUAL_FIELD')
  const images = ofKind<Imaging>('IMAGING')
  const plans = ofKind<GlaucomaPlan>('GLAUCOMA_PLAN')
  const glasses = ofKind<Glasses>('GLASSES')
  const lenses = ofKind<ContactLens>('CONTACT_LENS')
  const biometries = ofKind<Biometry>('BIOMETRY')
  const surgeries = ofKind<Surgery>('SURGERY')
  const asked = params.get('eye') as Tab | null
  const [tab, setTabState] = useState<Tab>(asked || 'exams')
  const setTab = (t: Tab) => { setTabState(t); const next = new URLSearchParams(params); next.set('eye', t); setParams(next, { replace: true }) }

  const put = (kind: string, date: string | undefined, data: object, done?: () => void, id?: string) =>
    save.mutate({ id, kind, date, data: data as Record<string, any> }, { onSuccess: () => done?.() })
  const del = (id: string) => remove.mutate(id)

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">{L('Chargement…')}</p>

  const last = exams[0]?.data
  const plan = plans[0]?.data
  const diagnosis = plan?.diagnosisOd || plan?.diagnosisOs || exams.find(e => e.data.diagnosis)?.data.diagnosis
  const tabs: [Tab, string, number?][] = [
    ['exams', 'Examens', exams.length], ['glaucoma', 'Glaucome'], ['fields', 'Champ visuel', fields.length], ['imaging', 'OCT / Imagerie', images.length],
    ['prescriptions', 'Prescriptions', glasses.length + lenses.length], ['surgery', 'Chirurgie', surgeries.length], ['history', 'Historique'],
  ]

  return (
    <div className="grid gap-4">
      {(last || diagnosis || plan?.treatment) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3 text-[0.9rem]">
          {diagnosis && <p><span className="text-[#5A6B65]">{L('Diagnostic')} : </span><b>{diagnosis}</b></p>}
          {last && <p><span className="text-[#5A6B65]">{L('AV corrigée')} : </span><b>OD {last.od?.vaCorrected || '—'} · {L('OG')} {last.os?.vaCorrected || '—'}</b></p>}
          {last && (last.od?.iop || last.os?.iop) && <p><span className="text-[#5A6B65]">{L('PIO')} : </span><b>{last.od?.iop ?? '—'} / {last.os?.iop ?? '—'} mmHg</b></p>}
          {plan?.treatment && <p><span className="text-[#5A6B65]">{L('Traitement')} : </span><b>{plan.treatment}</b></p>}
        </div>
      )}

      <div role="tablist" aria-label={L('Dossier ophtalmologique')} className="flex flex-wrap gap-1.5">
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold transition-colors', tab === key ? 'bg-primary text-white' : 'bg-white text-[#3F514A] ring-1 ring-[#D8E1DD] hover:text-primary')}>
            {L(label)}{count ? <span className={cn('ms-1.5 text-[0.78rem]', tab === key ? 'opacity-80' : 'text-[#5A6B65]')}>({count})</span> : null}
          </button>
        ))}
      </div>

      {tab === 'exams' && <ExamsTab exams={exams} saving={save.isPending} onDelete={del} onSave={(date, data, done) => put('EYE_EXAM', date, data, done)} />}
      {tab === 'glaucoma' && <GlaucomaTab exams={exams} fields={fields} images={images} plans={plans} saving={save.isPending} onSave={(data, id) => put('GLAUCOMA_PLAN', undefined, data, undefined, id)} />}
      {tab === 'fields' && <VisualFieldTab patientId={patient.id} fields={fields} saving={save.isPending} onDelete={del} onSave={(date, data, done) => put('VISUAL_FIELD', date, data, done)} />}
      {tab === 'imaging' && <ImagingTab patientId={patient.id} images={images} saving={save.isPending} onDelete={del} onSave={(date, data, done) => put('IMAGING', date, data, done)} />}
      {tab === 'prescriptions' && <PrescriptionsTab patient={patient} exams={exams} glasses={glasses} lenses={lenses} saving={save.isPending} onDelete={del} onSave={(kind, data, done) => put(kind, undefined, data, done)} />}
      {tab === 'surgery' && <SurgeryTab patient={patient} biometries={biometries} surgeries={surgeries} saving={save.isPending} onDelete={del} onSave={(kind, date, data, done) => put(kind, date, data, done)} />}
      {tab === 'history' && <HistoryTab records={records} />}
    </div>
  )
}
