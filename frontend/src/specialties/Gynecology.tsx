import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useL } from '../lib/labels'
import { cn, formatDateFR } from '../lib/utils'
import { Patient } from '../types'
import { useRecords } from './records'
import PregnancyTab from './gynecology/PregnancyTab'
import CalendarTab from './gynecology/CalendarTab'
import UltrasoundTab from './gynecology/UltrasoundTab'
import HistoryTab from './gynecology/HistoryTab'
import FollowupTab from './gynecology/FollowupTab'
import { checkStatus, dueDate, gestationalAge, PRENATAL, saLabel } from './gynecology/calc'
import { Followup, gravidityParity, lmpOf, PastPregnancy, Pregnancy, PrenatalCheck, Ultrasound, Visit } from './gynecology/shared'

type Tab = 'pregnancy' | 'calendar' | 'ultrasound' | 'history' | 'gyn'

/**
 * Gynecology-obstetrics: pregnancy follow-up (dating, visits, delivery), prenatal calendar, obstetric ultrasounds with
 * estimated fetal weight, obstetric history, and gynecological follow-up (contraception, cervical and breast screening).
 */
export default function Gynecology({ patient }: { patient: Patient }) {
  const L = useL()
  const [params, setParams] = useSearchParams()
  const { ofKind, save, remove, isLoading } = useRecords(patient.id, 'GYNECOLOGY')
  const pregnancies = ofKind<Pregnancy>('PREGNANCY')
  const visits = ofKind<Visit>('PREGNANCY_VISIT')
  const followups = ofKind<Followup>('GYN_FOLLOWUP')
  const checks = ofKind<PrenatalCheck>('PRENATAL_CHECK')
  const ultrasounds = ofKind<Ultrasound>('OB_ULTRASOUND')
  const past = ofKind<PastPregnancy>('OB_PAST')
  const [tab, setTabState] = useState<Tab>((params.get('gyn') as Tab | null) || 'pregnancy')
  const setTab = (t: Tab) => { setTabState(t); const next = new URLSearchParams(params); next.set('gyn', t); setParams(next, { replace: true }) }

  const put = (kind: string, date: string | undefined, data: object, done?: () => void, id?: string) =>
    save.mutate({ id, kind, date, data: data as Record<string, any> }, { onSuccess: () => done?.() })
  const del = (id: string) => remove.mutate(id)

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">{L('Chargement…')}</p>

  // Current pregnancy: the ongoing one, else the most recent.
  const current = pregnancies.find(p => p.data.status === 'ONGOING') || pregnancies[0]
  const ongoing = current?.data.status === 'ONGOING' ? current : undefined
  const lmp = ongoing ? lmpOf(ongoing.data) : null
  const weeks = lmp ? gestationalAge(lmp).total / 7 : 0
  const doneCodes = new Set(checks.filter(c => c.data.pregnancyId === ongoing?.id).map(c => c.data.code))
  const lateChecks = ongoing ? PRENATAL.filter(c => (!c.rhNegOnly || ongoing.data.rhesus === 'NEG') && checkStatus(c, weeks, doneCodes.has(c.code)) === 'late').length : 0
  const gp = gravidityParity(past.map(p => p.data), !!ongoing)
  const tabs: [Tab, string, number?, boolean?][] = [
    ['pregnancy', 'Grossesse', pregnancies.length], ['calendar', 'Calendrier prénatal', lateChecks, lateChecks > 0],
    ['ultrasound', 'Échographies', ultrasounds.filter(u => u.data.pregnancyId === current?.id).length], ['history', 'Antécédents', past.length], ['gyn', 'Suivi gynéco', followups.length],
  ]

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3 text-[0.9rem]">
        {ongoing && lmp
          ? <>
              <p><span className="text-[#5A6B65]">{L('Grossesse')} : </span><b>{saLabel(lmp)}</b></p>
              <p><span className="text-[#5A6B65]">{L('Terme prévu')} : </span><b>{formatDateFR(dueDate(lmp))}</b></p>
              {ongoing.data.rhesus && <p><span className="text-[#5A6B65]">{L('Groupe')} : </span><b className={ongoing.data.rhesus === 'NEG' ? 'text-[#B8372C]' : undefined}>{ongoing.data.bloodGroup ?? ''}{ongoing.data.rhesus === 'NEG' ? '−' : '+'}</b></p>}
            </>
          : <p className="text-[#5A6B65]">{L('Pas de grossesse en cours.')}</p>}
        <p><span className="text-[#5A6B65]">{L('Gestité / parité')} : </span><b>G{gp.g} P{gp.p}</b></p>
        {gp.cesareans > 0 && <p><span className="text-[#5A6B65]">{L('Césariennes')} : </span><b>{gp.cesareans}</b></p>}
      </div>

      <div role="tablist" aria-label={L('Dossier gynécologique')} className="flex flex-wrap gap-1.5">
        {tabs.map(([key, label, count, alert]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold transition-colors', tab === key ? 'bg-primary text-white' : 'bg-white text-[#3F514A] ring-1 ring-[#D8E1DD] hover:text-primary')}>
            {L(label)}{count ? <span className={cn('ms-1.5 text-[0.78rem]', tab === key ? 'opacity-80' : alert ? 'font-bold text-[#B8372C]' : 'text-[#5A6B65]')}>({count}{alert ? ' !' : ''})</span> : null}
          </button>
        ))}
      </div>

      {tab === 'pregnancy' && <PregnancyTab patient={patient} pregnancies={pregnancies} visits={visits} past={past} saving={save.isPending} onSave={put} onDelete={del} />}
      {tab === 'calendar' && <CalendarTab pregnancy={current} checks={checks} saving={save.isPending} onSave={put} onDelete={del} />}
      {tab === 'ultrasound' && <UltrasoundTab patientId={patient.id} pregnancy={current} ultrasounds={ultrasounds} saving={save.isPending} onSave={put} onDelete={del} />}
      {tab === 'history' && <HistoryTab past={past} pregnancies={pregnancies} saving={save.isPending} onSave={put} onDelete={del} />}
      {tab === 'gyn' && <FollowupTab patient={patient} followups={followups} saving={save.isPending} onSave={put} onDelete={del} />}
    </div>
  )
}
