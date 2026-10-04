import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Patient } from '../types'
import { useL } from '../lib/labels'
import { cn } from '../lib/utils'
import { useRecords } from './records'
import FollowUpTab from './cardiology/FollowUpTab'
import ScoresTab from './cardiology/ScoresTab'
import LabTab from './cardiology/LabTab'
import HistoryTab from './cardiology/HistoryTab'
import { EchoTab, EcgTab, HolterTab, StressTab } from './cardiology/ExamTabs'
import { Abpm, ANTICOAG, Echo, Ecg, Holter, Lab, Plan, Reading, Risk, Scores, Stress } from './cardiology/shared'

type Tab = 'follow' | 'scores' | 'ecg' | 'echo' | 'holter' | 'stress' | 'lab' | 'history'

/**
 * Cardiology: care plan and follow-up (BP, heart rate, INR), CHA2DS2-VASc / HAS-BLED, ECG, echocardiography,
 * Holter and ABPM, stress test, blood tests with eGFR, history.
 */
export default function Cardiology({ patient }: { patient: Patient }) {
  const L = useL()
  const [params, setParams] = useSearchParams()
  const { records, ofKind, save, remove, isLoading } = useRecords(patient.id, 'CARDIOLOGY')
  const plans = ofKind<Plan>('CARDIO_PLAN')
  const risks = ofKind<Risk>('CARDIO_RISK')
  const readings = ofKind<Reading>('CARDIO_READING')
  const scores = ofKind<Scores>('CARDIO_SCORES')
  const ecgs = ofKind<Ecg>('ECG')
  const echos = ofKind<Echo>('ECHO')
  const holters = ofKind<Holter>('HOLTER')
  const abpms = ofKind<Abpm>('ABPM')
  const stress = ofKind<Stress>('STRESS_TEST')
  const labs = ofKind<Lab>('CARDIO_LAB')
  const [tab, setTabState] = useState<Tab>((params.get('heart') as Tab | null) || 'follow')
  const setTab = (t: Tab) => { setTabState(t); const next = new URLSearchParams(params); next.set('heart', t); setParams(next, { replace: true }) }

  const put = (kind: string, date: string | undefined, data: object, done?: () => void, id?: string) =>
    save.mutate({ id, kind, date, data: data as Record<string, any> }, { onSuccess: () => done?.() })
  const del = (id: string) => remove.mutate(id)
  const exam = (kind: string) => ({ saving: save.isPending, onDelete: del, onSave: (date: string, data: object, done: () => void) => put(kind, date, data, done) })

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">{L('Chargement…')}</p>

  const plan = plans[0]?.data
  const lvef = echos.find(e => e.data.lvef != null)?.data.lvef
  const bp = readings.find(r => r.data.systolic)?.data
  const score = scores[0]?.data
  const tabs: [Tab, string, number?][] = [
    ['follow', 'Suivi', readings.length], ['scores', 'Scores'], ['ecg', 'ECG', ecgs.length], ['echo', 'Écho', echos.length],
    ['holter', 'Holter & MAPA', holters.length + abpms.length], ['stress', 'Épreuve d’effort', stress.length], ['lab', 'Biologie', labs.length], ['history', 'Historique'],
  ]

  return (
    <div className="grid gap-4">
      {(plan || lvef != null || bp || score) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3 text-[0.9rem]">
          {plan?.diagnosis && <p><span className="text-[#5A6B65]">{L('Diagnostic')} : </span><b>{plan.diagnosis}</b></p>}
          {plan && plan.anticoagulation !== 'NONE' && <p><span className="text-[#5A6B65]">{L('Anticoagulation')} : </span><b>{L(ANTICOAG[plan.anticoagulation])}</b></p>}
          {lvef != null && <p><span className="text-[#5A6B65]">FEVG : </span><b className={lvef <= 40 ? 'text-[#B8372C]' : undefined}>{lvef} %</b></p>}
          {bp && <p><span className="text-[#5A6B65]">{L('Dernière TA')} : </span><b>{bp.systolic}/{bp.diastolic ?? '?'} mmHg</b></p>}
          {score && <p><span className="text-[#5A6B65]">CHA₂DS₂-VASc / HAS-BLED : </span><b>{score.chadsvasc ?? '?'} / {score.hasbled ?? '?'}</b></p>}
        </div>
      )}

      <div role="tablist" aria-label={L('Dossier cardiologique')} className="flex flex-wrap gap-1.5">
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold transition-colors', tab === key ? 'bg-primary text-white' : 'bg-white text-[#3F514A] ring-1 ring-[#D8E1DD] hover:text-primary')}>
            {L(label)}{count ? <span className={cn('ms-1.5 text-[0.78rem]', tab === key ? 'opacity-80' : 'text-[#5A6B65]')}>({count})</span> : null}
          </button>
        ))}
      </div>

      {tab === 'follow' && <FollowUpTab plans={plans} risks={risks} readings={readings} saving={save.isPending} onSave={put} onDelete={del} />}
      {tab === 'scores' && <ScoresTab patient={patient} scores={scores} risk={risks[0]?.data} saving={save.isPending} onDelete={del} onSave={data => put('CARDIO_SCORES', undefined, data)} />}
      {tab === 'ecg' && <EcgTab patient={patient} patientId={patient.id} records={ecgs} {...exam('ECG')} />}
      {tab === 'echo' && <EchoTab patientId={patient.id} records={echos} {...exam('ECHO')} />}
      {tab === 'holter' && <HolterTab patientId={patient.id} holters={holters} abpms={abpms} saving={save.isPending} onDelete={del} onSave={(kind, date, data, done) => put(kind, date, data, done)} />}
      {tab === 'stress' && <StressTab patient={patient} patientId={patient.id} records={stress} {...exam('STRESS_TEST')} />}
      {tab === 'lab' && <LabTab patient={patient} labs={labs} plan={plan} {...exam('CARDIO_LAB')} />}
      {tab === 'history' && <HistoryTab records={records} />}
    </div>
  )
}
