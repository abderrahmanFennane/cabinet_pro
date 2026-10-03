import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CalendarClock, FileText, Printer, Wallet } from 'lucide-react'
import api from '../../lib/api'
import { apiError, useCabinetPath } from '../../lib/hooks'
import { cn, formatCurrency, formatDateFR } from '../../lib/utils'
import { Invoice, LineItem, Quote } from '../../types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import PaymentDialog from './PaymentDialog'

export const invoiceTone = (status: string) => (status === 'PAID' ? 'success' : status === 'PARTIAL' ? 'warning' : status === 'CANCELLED' ? 'secondary' : 'destructive') as any
export const quoteTone = (status: string) => (status === 'ACCEPTED' ? 'success' : status === 'REJECTED' ? 'destructive' : status === 'SENT' ? 'warning' : 'secondary') as any

export function LinesTable({ items, currency }: { items: LineItem[]; currency: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="p-2.5 text-start">Acte</th><th className="p-2.5 text-start">Dent(s)</th><th className="p-2.5 text-end">Qté</th><th className="p-2.5 text-end">Montant</th></tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-t border-border">
              <td className="p-2.5">{item.code ? <span className="me-1.5 font-mono text-xs text-primary">{item.code}</span> : null}{item.label}</td>
              <td className="p-2.5 font-mono text-xs">{[item.teeth, item.faces && `(${item.faces.replace(/,/g, '')})`].filter(Boolean).join(' ') || '—'}</td>
              <td className="p-2.5 text-end">{item.quantity}</td>
              <td className="p-2.5 text-end font-semibold">{formatCurrency(item.total, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type DetailProps = { id: string | null; onClose: () => void; cabinetApi: string; currency: string }

export function InvoiceDialog({ id, onClose, cabinetApi, currency }: DetailProps) {
  const { t } = useTranslation()
  const cabinetPath = useCabinetPath()
  const [paying, setPaying] = useState(false)
  const { data: invoice } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => (await api.get(`${cabinetApi}/billing/invoices/${id}`)).data.data as Invoice,
    enabled: !!id,
  })
  const remaining = invoice ? Number(invoice.total) - Number(invoice.paid) : 0

  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {!invoice ? <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p> : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">Facture {invoice.number} <Badge variant={invoiceTone(invoice.status)}>{t(`invoiceStatus.${invoice.status}`)}</Badge></DialogTitle>
              <DialogDescription>{invoice.patient.firstName} {invoice.patient.lastName} · {formatDateFR(invoice.date)}</DialogDescription>
            </DialogHeader>
            <LinesTable items={invoice.items || []} currency={currency} />
            <div className="grid gap-2 rounded-xl bg-muted p-3 text-sm sm:grid-cols-3">
              <p>Total <b className="block text-base">{formatCurrency(invoice.total, currency)}</b></p>
              <p>Payé <b className="block text-base">{formatCurrency(invoice.paid, currency)}</b></p>
              <p>Reste à payer <b className={cn('block text-base', remaining > 0 && 'text-destructive')}>{formatCurrency(remaining, currency)}</b></p>
            </div>
            {!!invoice.payments?.length && (
              <ul className="space-y-1 text-sm">
                {invoice.payments.map(p => <li key={p.id} className="flex justify-between"><span>{formatDateFR(p.paidAt)} · {t(`paymentMethod.${p.method}`)}{p.reference ? ` · ${p.reference}` : ''}</span><b>{formatCurrency(p.amount, currency)}</b></li>)}
              </ul>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" asChild><a href={cabinetPath(`/print/invoice/${invoice.id}`)} target="_blank" rel="noreferrer"><Printer size={16} className="me-1.5" />Imprimer</a></Button>
              {/* AMO managed by the CNSS: private sector, AMO Tadamon and, since law 54.23, the former CNOPS members. */}
              {['CNSS', 'CNOPS', 'AMO_TADAMON'].includes(invoice.patient.coverage) && invoice.status !== 'CANCELLED' && (
                <Button variant="outline" asChild><a href={cabinetPath(`/print/care-sheet/${invoice.id}`)} target="_blank" rel="noreferrer"><FileText size={16} className="me-1.5" />Feuille de soins CNSS</a></Button>
              )}
              {remaining > 0 && invoice.status !== 'CANCELLED' && <Button onClick={() => setPaying(true)}><Wallet size={16} className="me-1.5" />Encaisser</Button>}
            </div>
            <PaymentDialog open={paying} onOpenChange={setPaying} cabinetApi={cabinetApi} patientId={invoice.patient.id} currency={currency}
              target={{ invoiceId: invoice.id, label: `Facture ${invoice.number}`, remaining }} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function QuoteDialog({ id, onClose, cabinetApi, currency }: DetailProps) {
  const { t } = useTranslation()
  const cabinetPath = useCabinetPath()
  const queryClient = useQueryClient()
  const [paying, setPaying] = useState(false)
  const [count, setCount] = useState('3')
  const [firstDate, setFirstDate] = useState(new Date().toISOString().slice(0, 10))
  const { data: quote } = useQuery({
    queryKey: ['quote', id],
    queryFn: async () => (await api.get(`${cabinetApi}/billing/quotes/${id}`)).data.data as Quote,
    enabled: !!id,
  })
  const refresh = () => ['quote', 'quotes', 'dental-plans', 'patient'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
  const setStatus = useMutation({
    mutationFn: (status: Quote['status']) => api.patch(`${cabinetApi}/billing/quotes/${id}`, { status }),
    onSuccess: () => { toast.success('Devis mis à jour'); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const schedule = useMutation({
    mutationFn: () => api.post(`${cabinetApi}/billing/quotes/${id}/installments`, { count: Number(count), firstDate }),
    onSuccess: () => { toast.success('Échéancier créé'); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const nextDue = quote?.installments?.find(line => line.status !== 'PAID')

  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {!quote ? <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p> : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">Devis {quote.number} <Badge variant={quoteTone(quote.status)}>{t(`quoteStatus.${quote.status}`)}</Badge></DialogTitle>
              <DialogDescription>
                {quote.patient.firstName} {quote.patient.lastName} · {formatDateFR(quote.date)}{quote.validUntil ? ` · valable jusqu’au ${formatDateFR(quote.validUntil)}` : ''}
                {quote.treatmentPlan ? ` · plan « ${quote.treatmentPlan.title} »` : ''}
              </DialogDescription>
            </DialogHeader>
            <LinesTable items={quote.items || []} currency={currency} />
            <div className="grid gap-2 rounded-xl bg-muted p-3 text-sm sm:grid-cols-3">
              <p>Total <b className="block text-base">{formatCurrency(quote.total, currency)}</b></p>
              <p>Payé <b className="block text-base">{formatCurrency(quote.paid, currency)}</b></p>
              <p>Reste à payer <b className={cn('block text-base', quote.remaining > 0 && quote.status === 'ACCEPTED' && 'text-destructive')}>{formatCurrency(quote.remaining, currency)}</b></p>
            </div>

            {quote.status !== 'ACCEPTED' && quote.status !== 'REJECTED' && (
              <div className="flex flex-wrap gap-2">
                {quote.status === 'DRAFT' && <Button variant="outline" onClick={() => setStatus.mutate('SENT')}>Marquer comme remis au patient</Button>}
                <Button onClick={() => setStatus.mutate('ACCEPTED')}>Le patient accepte le devis</Button>
                <Button variant="ghost" onClick={() => setStatus.mutate('REJECTED')}>Refusé</Button>
              </div>
            )}

            {quote.status === 'ACCEPTED' && (
              <section className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock size={16} className="text-primary" />Échéancier</h4>
                {quote.installments?.length ? (
                  <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                    {quote.installments.map((line, index) => (
                      <li key={index} className="flex items-center justify-between gap-2 p-2.5">
                        <span>{formatDateFR(line.dueDate)}</span>
                        <span className="font-semibold">{formatCurrency(line.amount, currency)}</span>
                        <Badge variant={line.status === 'PAID' ? 'success' : line.status === 'LATE' ? 'destructive' : 'secondary'}>{line.status === 'PAID' ? 'Payée' : line.status === 'LATE' ? 'En retard' : 'À venir'}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-[100px_1fr_auto] sm:items-end">
                    <div className="space-y-1"><Label htmlFor="count">Échéances</Label><Input id="count" type="number" min={1} max={36} value={count} onChange={e => setCount(e.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor="first">Première échéance</Label><Input id="first" type="date" value={firstDate} onChange={e => setFirstDate(e.target.value)} /></div>
                    <Button variant="outline" onClick={() => schedule.mutate()} disabled={schedule.isPending}>Créer l’échéancier</Button>
                  </div>
                )}
                {!!quote.payments?.length && (
                  <ul className="space-y-1 text-sm">
                    {quote.payments.map(p => <li key={p.id} className="flex justify-between"><span>{formatDateFR(p.paidAt)} · {t(`paymentMethod.${p.method}`)}</span><b>{formatCurrency(p.amount, currency)}</b></li>)}
                  </ul>
                )}
              </section>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" asChild><a href={cabinetPath(`/print/quote/${quote.id}`)} target="_blank" rel="noreferrer"><Printer size={16} className="me-1.5" />Imprimer</a></Button>
              {quote.status === 'ACCEPTED' && quote.remaining > 0 && <Button onClick={() => setPaying(true)}><Wallet size={16} className="me-1.5" />Encaisser</Button>}
            </div>
            <PaymentDialog open={paying} onOpenChange={setPaying} cabinetApi={cabinetApi} patientId={quote.patient.id} currency={currency}
              target={{ quoteId: quote.id, label: `Devis ${quote.number}`, remaining: quote.remaining }}
              suggested={nextDue ? nextDue.amount - (nextDue.paid || 0) : undefined} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
