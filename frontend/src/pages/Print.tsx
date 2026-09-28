import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import api from '../lib/api'
import { practitionerName, useCabinetApi, useCabinetId } from '../lib/hooks'
import { formatCurrency, formatDateFR } from '../lib/utils'
import { insuranceText } from '../lib/insurance'
import { Cabinet, Invoice, MedicalDocument, Patient, Prescription, Quote } from '../types'
import { Button } from '../components/ui/button'
import { LinesTable } from '../components/billing/BillingDetails'

function useCabinet() {
  const cabinetId = useCabinetId()
  return useQuery({ queryKey: ['cabinet', cabinetId], queryFn: async () => (await api.get(`/cabinets/${cabinetId}`)).data.data as Cabinet, enabled: !!cabinetId, refetchInterval: false })
}

function PrintPage({ ready, children, signature }: { ready: boolean; children: React.ReactNode; signature?: string }) {
  const { data: cabinet } = useCabinet()
  useEffect(() => {
    if (!ready || !cabinet) return
    const id = setTimeout(() => window.print(), 400)
    return () => clearTimeout(id)
  }, [ready, cabinet])
  if (!ready || !cabinet) return <p className="p-10 text-center text-sm text-muted-foreground">Préparation du document…</p>
  return (
    <div className="min-h-screen bg-muted py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end px-4"><Button onClick={() => window.print()}><Printer size={16} className="me-1.5" />Imprimer / PDF</Button></div>
      <article className="print-page mx-auto flex min-h-[270mm] max-w-[210mm] flex-col bg-white p-[16mm] text-[13px] leading-relaxed text-black shadow-lg">
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#12705A] pb-4">
          <div>
            <p className="text-lg font-bold">{cabinet.name}</p>
            {cabinet.letterhead && <p className="whitespace-pre-line text-[12px]">{cabinet.letterhead}</p>}
          </div>
          <div className="text-end text-[12px]">
            {cabinet.address && <p>{cabinet.address}</p>}
            {cabinet.city && <p>{cabinet.city}</p>}
            {cabinet.phone && <p>Tél. {cabinet.phone}</p>}
            {cabinet.email && <p>{cabinet.email}</p>}
          </div>
        </header>
        <div className="flex-1 py-6">{children}</div>
        {signature && <footer className="ms-auto w-64 pt-8 text-center text-[12px]"><p>{signature}</p><p className="mt-14 border-t border-black/40 pt-1">Signature et cachet</p></footer>}
      </article>
    </div>
  )
}

const patientLine = (p?: Pick<Patient, 'firstName' | 'lastName' | 'sex'> | null, age?: number | null) =>
  p ? `${p.sex === 'F' ? 'Mme' : p.sex === 'M' ? 'M.' : ''} ${p.firstName} ${p.lastName.toUpperCase()}${age !== null && age !== undefined ? `, ${age} ans` : ''}`.trim() : ''

export function PrintPrescription() {
  const { patientId = '', id = '' } = useParams()
  const cabinetApi = useCabinetApi()
  const { data: patient } = useQuery({ queryKey: ['patient', patientId], queryFn: async () => (await api.get(`${cabinetApi}/patients/${patientId}`)).data.data as Patient, refetchInterval: false })
  const { data: rx } = useQuery({ queryKey: ['prescription', id], queryFn: async () => (await api.get(`${cabinetApi}/patients/${patientId}/prescriptions/${id}`)).data.data as Prescription, refetchInterval: false })
  return (
    <PrintPage ready={!!patient && !!rx} signature={practitionerName(rx?.practitioner)}>
      <div className="mb-6 flex justify-between"><p>{patientLine(patient, patient?.age)}</p><p>Le {formatDateFR(rx?.date)}</p></div>
      <h1 className="mb-6 text-center text-xl font-bold tracking-[0.2em]">ORDONNANCE</h1>
      <ol className="space-y-4">
        {rx?.items.map((item, i) => (
          <li key={i}><p className="font-bold">{i + 1}. {item.drug}</p>{item.dosage && <p className="ps-5">{item.dosage}</p>}{item.duration && <p className="ps-5">Pendant {item.duration}</p>}{item.notes && <p className="ps-5 italic">{item.notes}</p>}</li>
        ))}
      </ol>
      {rx?.notes && <p className="mt-6 whitespace-pre-line">{rx.notes}</p>}
    </PrintPage>
  )
}

export function PrintDocument() {
  const { patientId = '', id = '' } = useParams()
  const cabinetApi = useCabinetApi()
  const { data: doc } = useQuery({ queryKey: ['document', id], queryFn: async () => (await api.get(`${cabinetApi}/patients/${patientId}/documents/${id}`)).data.data as MedicalDocument, refetchInterval: false })
  return (
    <PrintPage ready={!!doc} signature={practitionerName(doc?.practitioner)}>
      <p className="mb-6 text-end">Le {formatDateFR(doc?.createdAt)}</p>
      <h1 className="mb-8 text-center text-xl font-bold uppercase tracking-[0.15em]">{doc?.title}</h1>
      <p className="whitespace-pre-line">{doc?.body}</p>
    </PrintPage>
  )
}

export function PrintInvoice() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const { data: cabinet } = useCabinet()
  const { data: inv } = useQuery({ queryKey: ['invoice', id], queryFn: async () => (await api.get(`${cabinetApi}/billing/invoices/${id}`)).data.data as Invoice, refetchInterval: false })
  const currency = cabinet?.currency || 'MAD'
  const remaining = inv ? Number(inv.total) - Number(inv.paid) : 0
  return (
    <PrintPage ready={!!inv}>
      {inv && (
        <div className="space-y-5">
          <div className="flex justify-between gap-6">
            <div><h1 className="text-xl font-bold">{Number(inv.paid) >= Number(inv.total) ? 'FACTURE ACQUITTÉE' : 'FACTURE'}</h1><p>N° {inv.number} · {formatDateFR(inv.date)}</p></div>
            <div className="text-end"><p className="font-bold">{patientLine(inv.patient as any)}</p>{inv.patient.address && <p>{inv.patient.address}</p>}{inv.patient.cin && <p>CIN {inv.patient.cin}</p>}{inv.patient.coverage !== 'NONE' && <p>{insuranceText(inv.patient, t).base}</p>}{inv.patient.insuredName && <p>Assuré : {inv.patient.insuredName}</p>}{insuranceText(inv.patient, t).complementary && <p>Complémentaire : {insuranceText(inv.patient, t).complementary}</p>}</div>
          </div>
          <LinesTable items={inv.items || []} currency={currency} />
          <div className="ms-auto w-64 space-y-1">
            <p className="flex justify-between"><span>Total</span><b>{formatCurrency(inv.total, currency)}</b></p>
            <p className="flex justify-between"><span>Payé</span><span>{formatCurrency(inv.paid, currency)}</span></p>
            <p className="flex justify-between border-t border-black/30 pt-1"><span>Reste à payer</span><b>{formatCurrency(remaining, currency)}</b></p>
          </div>
          {!!inv.payments?.length && <p className="text-[12px]">Règlements : {inv.payments.map(p => `${formatDateFR(p.paidAt)} ${t(`paymentMethod.${p.method}`)} ${formatCurrency(p.amount, currency)}`).join(' ; ')}</p>}
        </div>
      )}
    </PrintPage>
  )
}

export function PrintQuote() {
  const { id = '' } = useParams()
  const cabinetApi = useCabinetApi()
  const { data: cabinet } = useCabinet()
  const { data: quote } = useQuery({ queryKey: ['quote', id], queryFn: async () => (await api.get(`${cabinetApi}/billing/quotes/${id}`)).data.data as Quote, refetchInterval: false })
  const currency = cabinet?.currency || 'MAD'
  return (
    <PrintPage ready={!!quote}>
      {quote && (
        <div className="space-y-5">
          <div className="flex justify-between gap-6">
            <div><h1 className="text-xl font-bold">DEVIS</h1><p>N° {quote.number} · {formatDateFR(quote.date)}</p>{quote.validUntil && <p>Valable jusqu’au {formatDateFR(quote.validUntil)}</p>}</div>
            <div className="text-end"><p className="font-bold">{patientLine(quote.patient as any)}</p>{quote.patient.cin && <p>CIN {quote.patient.cin}</p>}</div>
          </div>
          <LinesTable items={quote.items || []} currency={currency} />
          <p className="text-end text-base">Total : <b>{formatCurrency(quote.total, currency)}</b></p>
          {!!quote.installments?.length && (
            <div><p className="mb-1 font-bold">Échéancier</p><ul>{quote.installments.map((line, i) => <li key={i}>{formatDateFR(line.dueDate)} : {formatCurrency(line.amount, currency)}</li>)}</ul></div>
          )}
          <div className="grid grid-cols-2 gap-8 pt-10 text-[12px]">
            <p className="border-t border-black/40 pt-1">Bon pour accord, date et signature du patient</p>
            <p className="border-t border-black/40 pt-1 text-end">Signature du praticien</p>
          </div>
        </div>
      )}
    </PrintPage>
  )
}
