import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useCabinetPath } from '../lib/hooks'
import { cn } from '../lib/utils'
import { useL } from '../lib/labels'
import { Patient } from '../types'
import { Button } from '../components/ui/button'
import { useRecords } from './records'
import { Empty } from './ui'
import GrowthTab from './pediatrics/GrowthTab'
import VaccinesTab from './pediatrics/VaccinesTab'
import DevelopmentTab from './pediatrics/DevelopmentTab'
import DosesTab from './pediatrics/DosesTab'
import CertificatesTab from './pediatrics/CertificatesTab'
import { milestoneLate, MILESTONES } from './pediatrics/calc'
import { ageLabel, Birth, Growth, Milestone, monthsBetween, PNI_CALENDAR, Screening, Vaccine } from './pediatrics/shared'

// Used by the printable health booklet.
export { Measure, PercentileChart, PNI_CALENDAR } from './pediatrics/shared'
export type { Point } from './pediatrics/shared'

type Tab = 'growth' | 'vaccines' | 'development' | 'doses' | 'certificates'

/** Pediatrics: growth (WHO curves, corrected age), vaccines (PNI), development and screenings, weight-based doses, certificates. */
export default function Pediatrics({ patient }: { patient: Patient }) {
  const L = useL()
  const cabinetPath = useCabinetPath()
  const [params, setParams] = useSearchParams()
  const { ofKind, save, remove, isLoading } = useRecords(patient.id, 'PEDIATRICS')
  const growth = ofKind<Growth>('GROWTH')
  const vaccines = ofKind<Vaccine>('VACCINE')
  const births = ofKind<Birth>('BIRTH')
  const milestones = ofKind<Milestone>('MILESTONE')
  const screenings = ofKind<Screening>('SCREENING')
  const [tab, setTabState] = useState<Tab>((params.get('child') as Tab | null) || 'growth')
  const setTab = (t: Tab) => { setTabState(t); const next = new URLSearchParams(params); next.set('child', t); setParams(next, { replace: true }) }

  const put = (kind: string, date: string | undefined, data: object, done?: () => void, id?: string) =>
    save.mutate({ id, kind, date, data: data as Record<string, any> }, { onSuccess: () => done?.() })
  const del = (id: string) => remove.mutate(id)

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">{L('Chargement…')}</p>

  const birth = patient.birthDate ? new Date(patient.birthDate) : null
  const age = birth ? monthsBetween(birth, new Date()) : null
  const done = new Set(vaccines.map(v => v.data.code))
  const lateVaccines = age === null ? 0 : PNI_CALENDAR.filter(v => (!v.girlsOnly || patient.sex !== 'M') && !done.has(v.code) && age > v.months + 1).length
  const reached = new Set(milestones.map(m => m.data.code))
  const lateMilestones = age === null ? 0 : MILESTONES.filter(m => !reached.has(m.code) && milestoneLate(m, age)).length
  const lastWeight = growth.find(g => g.data.weight)?.data.weight
  const ga = births[0]?.data.gestationalWeeks
  const tabs: [Tab, string, number?, boolean?][] = [
    ['growth', 'Croissance', growth.length], ['vaccines', 'Vaccins', lateVaccines, lateVaccines > 0], ['development', 'Développement', lateMilestones, lateMilestones > 0],
    ['doses', 'Doses'], ['certificates', 'Certificats'],
  ]

  return (
    <div className="grid gap-4">
      {!birth && <Empty>{L('Ajoutez la date de naissance de l’enfant (Modifier) pour calculer l’âge des mesures et des vaccins.')}</Empty>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3 text-[0.9rem]">
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          {age !== null && <p><span className="text-[#5A6B65]">{L('Âge')} : </span><b>{ageLabel(age, L)}</b></p>}
          {lastWeight != null && <p><span className="text-[#5A6B65]">{L('Poids')} : </span><b>{lastWeight} kg</b></p>}
          {ga != null && <p><span className="text-[#5A6B65]">{L('Terme')} : </span><b>{ga} SA{ga < 37 ? ` (${L('prématuré')})` : ''}</b></p>}
          {births[0]?.data.allergies && <p><span className="text-[#5A6B65]">{L('Allergies')} : </span><b className="text-[#B8372C]">{births[0].data.allergies}</b></p>}
          {age !== null && <p><span className="text-[#5A6B65]">{L('Vaccins')} : </span><b className={lateVaccines ? 'text-[#B8372C]' : 'text-[#1E7A45]'}>{lateVaccines ? `${lateVaccines} ${L('en retard')}` : L('à jour')}</b></p>}
        </div>
        <Button variant="outline" size="sm" asChild><a href={cabinetPath(`/print/child-booklet/${patient.id}`)} target="_blank" rel="noreferrer"><Printer size={15} className="me-1.5" />{L('Carnet de santé (imprimer)')}</a></Button>
      </div>

      <div role="tablist" aria-label={L('Dossier pédiatrique')} className="flex flex-wrap gap-1.5">
        {tabs.map(([key, label, count, alert]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold transition-colors', tab === key ? 'bg-primary text-white' : 'bg-white text-[#3F514A] ring-1 ring-[#D8E1DD] hover:text-primary')}>
            {L(label)}{count ? <span className={cn('ms-1.5 text-[0.78rem]', tab === key ? 'opacity-80' : alert ? 'font-bold text-[#B8372C]' : 'text-[#5A6B65]')}>({count}{alert ? ' !' : ''})</span> : null}
          </button>
        ))}
      </div>

      {tab === 'growth' && <GrowthTab patient={patient} growth={growth} births={births} saving={save.isPending} onSave={put} onDelete={del} />}
      {tab === 'vaccines' && <VaccinesTab patient={patient} vaccines={vaccines} saving={save.isPending} onSave={put} onDelete={del} />}
      {tab === 'development' && <DevelopmentTab patient={patient} milestones={milestones} screenings={screenings} saving={save.isPending} onSave={put} onDelete={del} />}
      {tab === 'doses' && <DosesTab patient={patient} growth={growth} birth={births[0]?.data} />}
      {tab === 'certificates' && <CertificatesTab patient={patient} vaccines={vaccines} />}
    </div>
  )
}
