import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { practitionerName, useCabinetApi } from '../lib/hooks'
import { formatDateFR } from '../lib/utils'
import { insuranceText } from '../lib/insurance'
import { Consultation, MedicalDocument, Patient, Prescription, Vitals } from '../types'
import { PrintPage, patientLine } from './Print'

const vitalsLine = (v?: Vitals | null) => !v ? '' : [
  v.systolic && v.diastolic ? `TA ${v.systolic}/${v.diastolic}` : null,
  v.pulse ? `pouls ${v.pulse}` : null, v.temperature ? `${v.temperature} °C` : null,
  v.weight ? `${v.weight} kg` : null, v.height ? `${v.height} cm` : null,
  v.glucose ? `glycémie ${v.glucose} g/L` : null, v.spo2 ? `SpO2 ${v.spo2} %` : null,
].filter(Boolean).join(' · ')

/** The whole patient file on paper (or "Save as PDF"): for a transfer, a second opinion or the patient's request. */
export default function PatientFilePrint() {
  const { patientId = '' } = useParams()
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const base = `${cabinetApi}/patients/${patientId}`
  const opts = { refetchInterval: false as const, staleTime: 0 }
  const { data: patient } = useQuery({ queryKey: ['patient', patientId], queryFn: async () => (await api.get(base)).data.data as Patient, ...opts })
  const { data: consultations } = useQuery({ queryKey: ['consultations', patientId, 'print'], queryFn: async () => (await api.get(`${base}/consultations`)).data.data as Consultation[], ...opts })
  const { data: prescriptions } = useQuery({ queryKey: ['prescriptions', patientId, 'print'], queryFn: async () => (await api.get(`${base}/prescriptions`)).data.data as Prescription[], ...opts })
  const { data: documents } = useQuery({ queryKey: ['documents', patientId, 'print'], queryFn: async () => (await api.get(`${base}/documents`)).data.data as MedicalDocument[], ...opts })
  const ready = !!patient && !!consultations && !!prescriptions && !!documents

  const section = (title: string, children: React.ReactNode) => (
    <section className="mb-5 break-inside-avoid-page">
      <h2 className="mb-2 border-b border-black/30 pb-1 text-[14px] font-bold uppercase tracking-[0.08em]">{title}</h2>
      {children}
    </section>
  )
  const field = (label: string, value?: string | null) => value ? <p><b>{label} :</b> <span className="whitespace-pre-line">{value}</span></p> : null

  return (
    <PrintPage ready={ready}>
      {patient && (
        <>
          <div className="mb-5 flex justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-[0.1em]">DOSSIER MÉDICAL</h1>
              <p className="text-[12px]">Édité le {formatDateFR(new Date().toISOString())} · document confidentiel</p>
            </div>
            <div className="text-end">
              <p className="font-bold">{patientLine(patient, patient.age)}</p>
              {patient.birthDate && <p>Né(e) le {formatDateFR(patient.birthDate)}</p>}
              {patient.cin && <p>CIN {patient.cin}</p>}
            </div>
          </div>

          {section('Identité et couverture', (
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
              {field('Téléphone', patient.phone)}
              {field('Adresse', patient.address)}
              {field('Couverture', patient.coverage !== 'NONE' ? insuranceText(patient, t).base : 'Aucune')}
              {field('Complémentaire', insuranceText(patient, t).complementary || null)}
              {field('Groupe sanguin', patient.bloodGroup)}
            </div>
          ))}

          {section('Antécédents et traitements', (
            <div className="space-y-1">
              {field('Allergies', patient.allergies || 'Aucune connue')}
              {field('Antécédents médicaux', patient.medicalHistory)}
              {field('Antécédents chirurgicaux', patient.surgicalHistory)}
              {field('Antécédents familiaux', patient.familyHistory)}
              {field('Traitements en cours', patient.currentTreatments)}
            </div>
          ))}

          {section(`Consultations (${consultations!.length})`, consultations!.length === 0 ? <p>Aucune consultation.</p> : (
            <ol className="space-y-3">
              {consultations!.map(c => (
                <li key={c.id} className="break-inside-avoid border-s-2 border-black/20 ps-3">
                  <p className="font-bold">{formatDateFR(c.date)} · {practitionerName(c.practitioner)}{c.status === 'DRAFT' ? ' · brouillon' : ''}</p>
                  {field('Motif', c.reason)}
                  {vitalsLine(c.vitals) && <p><b>Constantes :</b> {vitalsLine(c.vitals)}</p>}
                  {field('Examen', c.examination)}
                  {field('Diagnostic', [c.diagnosisCode, c.diagnosis].filter(Boolean).join(' · ') || null)}
                  {field('Conduite à tenir', c.plan)}
                </li>
              ))}
            </ol>
          ))}

          {section(`Ordonnances (${prescriptions!.length})`, prescriptions!.length === 0 ? <p>Aucune ordonnance.</p> : (
            <ol className="space-y-2">
              {prescriptions!.map(rx => (
                <li key={rx.id} className="break-inside-avoid">
                  <p className="font-bold">{formatDateFR(rx.date)} · {practitionerName(rx.practitioner)}</p>
                  <ul className="ps-4">{rx.items.map((item, i) => <li key={i}>{item.drug}{item.dosage ? ` — ${item.dosage}` : ''}{item.duration ? ` · ${item.duration}` : ''}</li>)}</ul>
                </li>
              ))}
            </ol>
          ))}

          {section(`Certificats et courriers (${documents!.length})`, documents!.length === 0 ? <p>Aucun document.</p> : (
            <ul className="space-y-0.5">{documents!.map(d => <li key={d.id}>{formatDateFR(d.createdAt)} · {d.title}</li>)}</ul>
          ))}
        </>
      )}
    </PrintPage>
  )
}
