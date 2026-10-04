import { useState } from 'react'
import { CalendarPlus, CheckCircle2, Pill, Wallet } from 'lucide-react'
import { useAuth } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { cn } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../ui/button'
import ChargeForm from '../billing/ChargeForm'
import PrescriptionForm from './PrescriptionForm'
import AppointmentDialog from '../agenda/AppointmentDialog'

const NEXT: [string, number][] = [['1 semaine', 7], ['2 semaines', 14], ['1 mois', 30], ['3 mois', 91], ['6 mois', 182], ['1 an', 365]]

/** One block of the end of visit, with a check mark once done. */
function Step({ icon, title, done, children }: { icon: React.ReactNode; title: string; done?: string | null; children: React.ReactNode }) {
  return (
    <section className={cn('grid gap-3 rounded-[14px] border p-4', done ? 'border-[#BFE3CC] bg-[#F3FAF6]' : 'border-[#D8E1DD] bg-white')}>
      <h4 className="flex items-center gap-2 font-bold">{done ? <CheckCircle2 size={18} className="text-[#1E7A45]" /> : icon}{title}{done && <span className="text-[0.86rem] font-semibold text-[#1E7A45]">· {done}</span>}</h4>
      {children}
    </section>
  )
}

/**
 * End of visit, right after the consultation is finished, in the same window:
 * prescription, payment and next appointment. Every block is optional; "Terminer" closes.
 */
export default function VisitWrapUp({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const L = useL()
  const { hasPermissions } = useAuth()
  const [rxDone, setRxDone] = useState(false)
  const [rxOpen, setRxOpen] = useState(true)
  const [paid, setPaid] = useState(false)
  const [next, setNext] = useState<Date | null>(null)
  const [nextLabel, setNextLabel] = useState('')
  const [booked, setBooked] = useState<string | null>(null)
  const canRx = hasPermissions('MANAGE_PRESCRIPTIONS')
  const canBill = hasPermissions('MANAGE_BILLING')
  const canBook = hasPermissions('MANAGE_APPOINTMENTS')

  const pickNext = (days: number, label: string) => {
    // Same time of day as now, rounded to the quarter hour; the window lets the time be changed before saving.
    const d = new Date(); d.setDate(d.getDate() + days); d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0)
    setNextLabel(label); setNext(d)
  }

  return (
    <div className="grid gap-3">
      {canRx && (
        <Step icon={<Pill size={18} className="text-primary" />} title={L('Ordonnance')} done={rxDone ? L('imprimée') : null}>
          {rxOpen
            ? <PrescriptionForm patient={patient} compact onCreated={() => { setRxDone(true); setRxOpen(false) }} />
            : <div><Button type="button" size="sm" variant="outline" onClick={() => setRxOpen(true)}>{L('Autre ordonnance')}</Button></div>}
        </Step>
      )}

      {canBill
        ? (
          <Step icon={<Wallet size={18} className="text-primary" />} title={L('Paiement')} done={paid ? L('enregistré') : null}>
            {!paid && <ChargeForm patientId={patient.id} mode="visit" onDone={() => setPaid(true)} />}
          </Step>
        )
        : <p className="rounded-xl bg-[#F4F7F6] px-3 py-2 text-[0.88rem] text-[#5A6B65]">{L('Le paiement se fait à l’accueil.')}</p>}

      {canBook && (
        <Step icon={<CalendarPlus size={18} className="text-primary" />} title={L('Prochain rendez-vous')} done={booked ? `${L('dans')} ${L(booked)}` : null}>
          <div className="flex flex-wrap gap-1.5">
            {NEXT.map(([label, days]) => (
              <Button key={label} type="button" size="sm" variant="outline" onClick={() => pickNext(days, label)}>{L('Dans')} {L(label)}</Button>
            ))}
          </div>
        </Step>
      )}

      <div className="flex justify-end pt-1"><Button type="button" size="lg" onClick={onClose}>{L('Terminer la visite')}</Button></div>
      <AppointmentDialog open={next !== null} onOpenChange={(open) => { if (!open) { setNext(null) } }}
        patient={{ id: patient.id, firstName: patient.firstName, lastName: patient.lastName }} defaultDate={next ?? undefined} onSaved={() => setBooked(nextLabel)} />
    </div>
  )
}
