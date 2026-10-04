import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import { useAuth, useCabinetApi } from '../../lib/hooks'
import { formatCurrency, formatDateFR } from '../../lib/utils'
import { Invoice, Patient, Quote } from '../../types'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { InvoiceDialog, QuoteDialog, invoiceTone, quoteTone } from '../billing/BillingDetails'
import ChargeForm from '../billing/ChargeForm'
import { useL } from '../../lib/labels'

/** Invoices and quotes of one patient, and manual invoices from the act catalogue. */
export default function PatientBillingTab({ patient, currency }: { patient: Patient; currency: string }) {
  const L = useL()
  const { t } = useTranslation()
  const { hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const canQuote = hasPermissions('DENTAL_TREATMENT_PLAN')
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: invoices = [] } = useQuery({ queryKey: ['invoices', 'patient', patient.id], queryFn: async () => (await api.get(`${cabinetApi}/billing/invoices`, { params: { patientId: patient.id } })).data.data as Invoice[] })
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes', 'patient', patient.id], queryFn: async () => (await api.get(`${cabinetApi}/billing/quotes`, { params: { patientId: patient.id } })).data.data as Quote[], enabled: canQuote })

  const due = invoices.filter(i => i.status !== 'CANCELLED').reduce((s, i) => s + Number(i.total) - Number(i.paid), 0)
  const quoteDue = quotes.filter(q => q.status === 'ACCEPTED').reduce((s, q) => s + q.remaining, 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[#D8E1DD] bg-white p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{L('Reste à payer (factures)')}</p><p className="text-2xl font-bold">{formatCurrency(due, currency)}</p></div>
        {canQuote && <div className="rounded-[14px] border border-[#D8E1DD] bg-white p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{L('Reste à payer (devis acceptés)')}</p><p className="text-2xl font-bold">{formatCurrency(quoteDue, currency)}</p></div>}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{L('Factures')}</h3><Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus size={16} className="me-1" />{L('Facture')}</Button></div>
        {invoices.length === 0 && <p className="text-sm text-muted-foreground">{L('Aucune facture. Les actes réalisés sont facturés automatiquement.')}</p>}
        {invoices.map(inv => (
          <button key={inv.id} type="button" onClick={() => setInvoiceId(inv.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 text-start text-sm hover:bg-muted">
            <span><b className="font-mono">{inv.number}</b> · {formatDateFR(inv.date)}</span>
            <span className="flex items-center gap-2"><b>{formatCurrency(inv.total, currency)}</b><Badge variant={invoiceTone(inv.status)}>{t(`invoiceStatus.${inv.status}`)}</Badge></span>
          </button>
        ))}
      </section>

      {canQuote && (
        <section className="space-y-2">
          <h3 className="text-lg font-bold">{L('Devis')}</h3>
          {quotes.length === 0 && <p className="text-sm text-muted-foreground">{L('Aucun devis. Générez-en un depuis un plan de traitement.')}</p>}
          {quotes.map(q => (
            <button key={q.id} type="button" onClick={() => setQuoteId(q.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 text-start text-sm hover:bg-muted">
              <span><b className="font-mono">{q.number}</b> · {formatDateFR(q.date)}</span>
              <span className="flex items-center gap-2"><b>{formatCurrency(q.total, currency)}</b>{q.status === 'ACCEPTED' && <span className="text-xs text-muted-foreground">reste {formatCurrency(q.remaining, currency)}</span>}<Badge variant={quoteTone(q.status)}>{t(`quoteStatus.${q.status}`)}</Badge></span>
            </button>
          ))}
        </section>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{L('Nouvelle facture')}</DialogTitle></DialogHeader>
          {creating && <ChargeForm patientId={patient.id} mode="invoice" onDone={() => setCreating(false)} />}
        </DialogContent>
      </Dialog>

      <InvoiceDialog id={invoiceId} onClose={() => setInvoiceId(null)} cabinetApi={cabinetApi} currency={currency} />
      <QuoteDialog id={quoteId} onClose={() => setQuoteId(null)} cabinetApi={cabinetApi} currency={currency} />
    </div>
  )
}
