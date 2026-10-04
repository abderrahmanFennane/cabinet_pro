import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarDays, FileImage, FileSignature, FileText, Pill, Stethoscope, Wallet, Wrench } from 'lucide-react'
import api from '../../lib/api'
import { useCabinetApi } from '../../lib/hooks'
import { formatCurrency, formatDateTimeFR } from '../../lib/utils'
import { TimelineEvent } from '../../types'
import { useL } from '../../lib/labels'

const ICONS: Record<TimelineEvent['kind'], React.ReactNode> = {
  APPOINTMENT: <CalendarDays size={15} />, CONSULTATION: <Stethoscope size={15} />, ACT: <Wrench size={15} />, PRESCRIPTION: <Pill size={15} />,
  DOCUMENT: <FileSignature size={15} />, ATTACHMENT: <FileImage size={15} />, INVOICE: <FileText size={15} />, PAYMENT: <Wallet size={15} />,
}

/** F-PAT-04: consultations, acts, prescriptions, documents and payments in a single feed. */
export default function TimelineTab({ patientId, currency }: { patientId: string; currency: string }) {
  const L = useL()
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['timeline', patientId],
    queryFn: async () => (await api.get(`${cabinetApi}/patients/${patientId}/timeline`)).data.data as TimelineEvent[],
  })
  if (isLoading) return <p className="text-sm text-muted-foreground">{L('Chargement…')}</p>
  if (!events.length) return <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{L('Rien pour l’instant.')}</p>
  const statusLabel = (e: TimelineEvent) => {
    if (!e.status) return null
    if (e.kind === 'APPOINTMENT') return t(`appointmentStatus.${e.status}`)
    if (e.kind === 'INVOICE') return t(`invoiceStatus.${e.status}`)
    if (e.kind === 'PAYMENT') return t(`paymentMethod.${e.status}`)
    if (e.kind === 'CONSULTATION') return e.status === 'LOCKED' ? L('Verrouillée') : L('Brouillon')
    return null
  }
  return (
    <ol className="relative space-y-3 border-s-2 border-border ps-5">
      {events.map(e => (
        <li key={`${e.kind}-${e.id}`} className="relative">
          <span className="absolute -start-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-accent text-primary">{ICONS[e.kind]}</span>
          <div className="rounded-xl border border-border bg-white p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{e.title}</p>
              {e.amount !== undefined && <b className="text-sm">{formatCurrency(e.amount, currency)}</b>}
            </div>
            <p className="text-xs text-muted-foreground">{[formatDateTimeFR(e.date), e.by, statusLabel(e)].filter(Boolean).join(' · ')}</p>
            {e.detail && <p className="mt-1 text-sm">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
