import { Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CalendarPlus, FileDown, Lock, Pencil, Phone, Wallet } from 'lucide-react'
import api from '../lib/api'
import { practitionerName, useAuth, useCabinetApi, useCabinetPath, useTeam } from '../lib/hooks'
import { cn, formatCurrency, formatDateFR, formatDateTimeFR } from '../lib/utils'
import { Patient, Specialty } from '../types'
import { SPECIALTY_MODULES } from '../specialties/registry'
import { insuranceShort, insuranceText } from '../lib/insurance'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import PatientFormDialog from '../components/patient/PatientFormDialog'
import AppointmentDialog from '../components/agenda/AppointmentDialog'
import DentalTab from '../components/dental/DentalTab'
import ConsultationsTab from '../components/patient/ConsultationsTab'
import DocumentsTab from '../components/patient/DocumentsTab'
import FilesTab from '../components/patient/FilesTab'
import PatientBillingTab from '../components/patient/PatientBillingTab'
import TimelineTab from '../components/patient/TimelineTab'
import { useL } from '../lib/labels'

type TabKey = 'summary' | 'dental' | 'consultations' | 'documents' | 'billing' | `mod-${Specialty}`
// Older links pointed to tabs that are now merged into another one.
const MERGED: Record<string, TabKey> = { files: 'documents', timeline: 'summary' }

export default function PatientRecord() {
  const L = useL()
  const { patientId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const { user, hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const navigate = useNavigate()
  const { data: team = [] } = useTeam()
  const [editing, setEditing] = useState(false)
  const [booking, setBooking] = useState(false)

  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => (await api.get(`${cabinetApi}/patients/${patientId}`)).data.data as Patient,
    refetchInterval: false,
  })

  const medical = hasPermissions('VIEW_MEDICAL')
  // Specialty modules shown: the doctor's own; the owner and the Super Admin also see the other specialties of the team
  // (multi-specialty cabinet), so the record shows every module that follows the patient.
  const teamSpecialties = team.filter(m => m.role === 'OWNER' || m.role === 'PRACTITIONER').map(m => m.specialty).filter(Boolean) as Specialty[]
  const moduleSpecialties: Specialty[] = !medical ? [] : [...new Set([
    user?.specialty,
    ...(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN' ? [...teamSpecialties, user?.cabinet?.specialty] : []),
  ].filter(Boolean) as Specialty[])]
  const dentist = moduleSpecialties.includes('DENTISTRY') && hasPermissions('DENTAL_CHART')
  const modules = moduleSpecialties.filter(code => code !== 'DENTISTRY').map(code => SPECIALTY_MODULES[code]).filter(m => m?.component)
  const ownModule = user?.specialty && user.specialty !== 'DENTISTRY' && modules.find(m => m.code === user.specialty)
  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: 'dental', label: L('Dents'), show: dentist },
    ...modules.map(m => ({ key: `mod-${m.code}` as TabKey, label: L(m.tab), show: true })),
    { key: 'consultations', label: L('Consultations'), show: medical },
    { key: 'documents', label: L('Documents'), show: medical || hasPermissions('PRINT_DOCUMENTS') },
    { key: 'billing', label: L('Paiements'), show: hasPermissions('MANAGE_BILLING') },
    { key: 'summary', label: L('Infos'), show: true },
  ]
  const visible = tabs.filter(tab => tab.show)
  const consultFrom = searchParams.get('consult')
  const asked = searchParams.get('tab')
  const requested = (asked ? MERGED[asked] || asked
    : consultFrom ? 'consultations'
    : user?.specialty === 'DENTISTRY' && dentist ? 'dental'
    : ownModule ? `mod-${ownModule.code}`
    : dentist ? 'dental' : modules[0] ? `mod-${modules[0].code}` : 'summary') as TabKey
  const tab = visible.some(x => x.key === requested) ? requested : 'summary'
  const setTab = (key: TabKey) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    next.delete('consult')
    setSearchParams(next, { replace: true })
  }

  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">{L('Chargement du dossier…')}</p>
  if (error || !patient) return <p className="py-10 text-center text-sm text-muted-foreground">{L('Dossier introuvable ou accès non autorisé.')}</p>

  const currency = user?.cabinet?.currency || 'MAD'
  const allergies = patient.allergies?.split(',').map(a => a.trim()).filter(Boolean) || []
  const referent = team.find(m => m.id === patient.primaryPractitionerId)

  return (
    <div className="space-y-5">
      <PageHeader
        onBack={() => navigate(cabinetPath('/patients'))}
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle={[patient.age !== null && `${patient.age} ${L('ans')}`, patient.sex === 'F' ? L('Femme') : patient.sex === 'M' ? L('Homme') : null, insuranceShort(patient, t) || t('coverage.NONE'), patient.cin && `CIN ${patient.cin}`].filter(Boolean).join(' · ')}
        actions={(
          <div className="flex flex-wrap gap-2">
            {patient.phone && <Button variant="outline" asChild><a href={`tel:${patient.phone}`}><Phone size={16} className="me-1.5" />{patient.phone}</a></Button>}
            {hasPermissions('MANAGE_APPOINTMENTS') && <Button variant="outline" onClick={() => setBooking(true)}><CalendarPlus size={16} className="me-1.5" />{L('Rendez-vous')}</Button>}
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil size={16} className="me-1.5" />{L('Modifier')}</Button>
            {medical && <Button variant="outline" asChild><a href={cabinetPath(`/print/patient/${patient.id}`)} target="_blank" rel="noreferrer" title={t('patientFile.exportHint')}><FileDown size={16} className="me-1.5" />{t('patientFile.export')}</a></Button>}
            {!medical && hasPermissions('MANAGE_BILLING') && <Button onClick={() => setTab('billing')}><Wallet size={16} className="me-1.5" />{L('Encaisser')}</Button>}
          </div>
        )}
      />

      {/* F-PAT-02: allergies shown on every page of the patient */}
      {allergies.length > 0 && (
        <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-[#FBE3E0] px-4 py-2.5 font-bold text-[#B8372C]">
          <AlertTriangle size={18} className="shrink-0" /> Allergies : {allergies.join(', ')}
        </div>
      )}

      <div role="tablist" aria-label={L('Dossier patient')} className="flex gap-1 overflow-x-auto border-b border-[#D8E1DD]">
        {visible.map(x => (
          <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)}
            className={cn('-mb-px shrink-0 whitespace-nowrap border-b-[2.5px] px-3.5 py-2.5 font-semibold transition-colors', tab === x.key ? 'border-primary text-[#14231E]' : 'border-transparent text-[#5A6B65] hover:text-[#14231E]')}>
            {x.label}
          </button>
        ))}
      </div>

      {!medical && (
        <div className="flex items-center gap-2.5 rounded-xl bg-[#E9EFEC] px-3.5 py-3 text-[0.9rem] text-[#5A6B65]">
          <Lock size={18} className="shrink-0" />{L('Le schéma dentaire, les consultations et les notes médicales sont réservés aux médecins.')}
        </div>
      )}

      <div role="tabpanel">
        {tab === 'summary' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-2 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px] text-sm">
              <h3 className="text-base font-bold">{L('Informations')}</h3>
              <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">{L('Naissance')}</dt><dd>{formatDateFR(patient.birthDate)}</dd>
                <dt className="text-muted-foreground">{L('Téléphone')}</dt><dd>{patient.phone || '—'}</dd>
                <dt className="text-muted-foreground">{L('Email')}</dt><dd className="break-all">{patient.email || '—'}</dd>
                <dt className="text-muted-foreground">{L('Adresse')}</dt><dd>{patient.address || '—'}</dd>
                <dt className="text-muted-foreground">{L('Assurance')}</dt><dd>{insuranceText(patient, t).base}</dd>
                {patient.insuredName && <><dt className="text-muted-foreground">{L('Assuré principal')}</dt><dd>{patient.insuredName}</dd></>}
                {patient.coverage !== 'PRIVATE' && patient.coverage !== 'MUTUELLE' && <><dt className="text-muted-foreground">{L('Complémentaire')}</dt><dd>{insuranceText(patient, t).complementary || L('Aucune')}</dd></>}
                <dt className="text-muted-foreground">{L('Référent')}</dt><dd>{referent ? practitionerName(referent) : '—'}</dd>
                <dt className="text-muted-foreground">{L('Consentements')}</dt><dd>{patient.consentDataAt ? `${L('Données')} ✓ (${formatDateFR(patient.consentDataAt)})` : L('Données ✗')} · {patient.consentRemindersAt ? L('Rappels ✓') : L('Rappels ✗')}</dd>
              </dl>
            </section>
            <section className="space-y-3 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px] text-sm">
              <h3 className="text-base font-bold">{L('Suivi')}</h3>
              <p><span className="text-muted-foreground">{L('Prochain rendez-vous :')} </span>{patient.nextAppointment ? `${formatDateTimeFR(patient.nextAppointment.date)} ${L('avec')} ${practitionerName(patient.nextAppointment.practitioner)}` : 'aucun'}</p>
              {patient.balanceDue !== undefined && <p><span className="text-muted-foreground">{L('Reste à payer :')} </span><b className={cn(patient.balanceDue > 0 && 'text-destructive')}>{formatCurrency(patient.balanceDue, currency)}</b></p>}
              {patient.notes && <p className="whitespace-pre-line"><span className="text-muted-foreground">{L('Notes :')} </span>{patient.notes}</p>}
            </section>
            {medical && (
              <section className="space-y-2 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px] text-sm lg:col-span-2">
                <h3 className="text-base font-bold">{L('Antécédents')}</h3>
                <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {[[L('Médicaux'), patient.medicalHistory], [L('Chirurgicaux'), patient.surgicalHistory], [L('Familiaux'), patient.familyHistory], [L('Traitements en cours'), patient.currentTreatments], ['Groupe sanguin', patient.bloodGroup]].map(([label, value]) => (
                    <div key={label as string}><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="whitespace-pre-line">{value || '—'}</dd></div>
                  ))}
                </dl>
              </section>
            )}
            <section className="space-y-3 lg:col-span-2">
              <h3 className="text-base font-bold">{L('Chronologie')}</h3>
              <TimelineTab patientId={patient.id} currency={currency} />
            </section>
          </div>
        )}
        {tab === 'dental' && <DentalTab patient={patient} currency={currency} />}
        {modules.map(m => {
          const Module = m.component!
          return tab === `mod-${m.code}` && (
            <Suspense key={m.code} fallback={<p className="py-8 text-center text-sm text-muted-foreground">{L('Chargement…')}</p>}>
              <Module patient={patient} />
            </Suspense>
          )
        })}
        {tab === 'consultations' && <ConsultationsTab patient={patient} appointmentId={consultFrom} />}
        {tab === 'documents' && (
          <div className="space-y-6">
            <DocumentsTab patient={patient} />
            {medical && <FilesTab patient={patient} />}
          </div>
        )}
        {tab === 'billing' && <PatientBillingTab patient={patient} currency={currency} />}
      </div>

      <PatientFormDialog open={editing} onOpenChange={setEditing} patient={patient} />
      <AppointmentDialog open={booking} onOpenChange={setBooking} patient={patient} />
    </div>
  )
}
