import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { apiError, useAuth, useCabinetApi } from '../../lib/hooks'
import { formatCurrency, formatDateFR } from '../../lib/utils'
import { Act, Invoice, Patient, Quote } from '../../types'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { NativeSelect } from '../ui/native-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { InvoiceDialog, QuoteDialog, invoiceTone, quoteTone } from '../billing/BillingDetails'

type Line = { actId: string | null; code: string | null; label: string; quantity: number; unitPrice: number }

/** Invoices and quotes of one patient, and manual invoices from the act catalogue. */
export default function PatientBillingTab({ patient, currency }: { patient: Patient; currency: string }) {
  const { t } = useTranslation()
  const { hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const canQuote = hasPermissions('DENTAL_TREATMENT_PLAN')
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [lines, setLines] = useState<Line[]>([])

  const { data: invoices = [] } = useQuery({ queryKey: ['invoices', 'patient', patient.id], queryFn: async () => (await api.get(`${cabinetApi}/billing/invoices`, { params: { patientId: patient.id } })).data.data as Invoice[] })
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes', 'patient', patient.id], queryFn: async () => (await api.get(`${cabinetApi}/billing/quotes`, { params: { patientId: patient.id } })).data.data as Quote[], enabled: canQuote })
  const { data: acts = [] } = useQuery({ queryKey: ['acts', cabinetApi], queryFn: async () => (await api.get(`${cabinetApi}/acts`)).data.data as Act[], enabled: creating, refetchInterval: false })

  const create = useMutation({
    mutationFn: () => api.post(`${cabinetApi}/billing/invoices`, { patientId: patient.id, items: lines }),
    onSuccess: (res) => {
      toast.success('Facture créée')
      setCreating(false)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] })
      setInvoiceId(res.data.data.id)
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const due = invoices.filter(i => i.status !== 'CANCELLED').reduce((s, i) => s + Number(i.total) - Number(i.paid), 0)
  const quoteDue = quotes.filter(q => q.status === 'ACCEPTED').reduce((s, q) => s + q.remaining, 0)
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[#D8E1DD] bg-white p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Reste à payer (factures)</p><p className="text-2xl font-bold">{formatCurrency(due, currency)}</p></div>
        {canQuote && <div className="rounded-[14px] border border-[#D8E1DD] bg-white p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Reste à payer (devis acceptés)</p><p className="text-2xl font-bold">{formatCurrency(quoteDue, currency)}</p></div>}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Factures</h3><Button size="sm" variant="outline" onClick={() => { setLines([]); setCreating(true) }}><Plus size={16} className="me-1" />Facture</Button></div>
        {invoices.length === 0 && <p className="text-sm text-muted-foreground">Aucune facture. Les actes réalisés sont facturés automatiquement.</p>}
        {invoices.map(inv => (
          <button key={inv.id} type="button" onClick={() => setInvoiceId(inv.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 text-start text-sm hover:bg-muted">
            <span><b className="font-mono">{inv.number}</b> · {formatDateFR(inv.date)}</span>
            <span className="flex items-center gap-2"><b>{formatCurrency(inv.total, currency)}</b><Badge variant={invoiceTone(inv.status)}>{t(`invoiceStatus.${inv.status}`)}</Badge></span>
          </button>
        ))}
      </section>

      {canQuote && (
        <section className="space-y-2">
          <h3 className="text-lg font-bold">Devis</h3>
          {quotes.length === 0 && <p className="text-sm text-muted-foreground">Aucun devis. Générez-en un depuis un plan de traitement.</p>}
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
          <DialogHeader><DialogTitle>Nouvelle facture</DialogTitle></DialogHeader>
          <NativeSelect aria-label="Ajouter un acte" value="" onChange={e => {
            const act = acts.find(a => a.id === e.target.value)
            if (act) setLines(list => [...list, { actId: act.id, code: act.code, label: act.name, quantity: 1, unitPrice: Number(act.price) }])
          }}>
            <option value="">Ajouter un acte du catalogue…</option>
            {acts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name} ({formatCurrency(a.price, currency)})</option>)}
          </NativeSelect>
          <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setLines(list => [...list, { actId: null, code: null, label: '', quantity: 1, unitPrice: 0 }])}>Ligne libre</Button>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_64px_100px_auto] gap-2">
                <Input value={line.label} placeholder="Libellé" aria-label="Libellé" onChange={e => setLines(l => l.map((x, i) => (i === index ? { ...x, label: e.target.value } : x)))} />
                <Input type="number" min={1} value={line.quantity} aria-label="Quantité" onChange={e => setLines(l => l.map((x, i) => (i === index ? { ...x, quantity: Number(e.target.value) || 1 } : x)))} />
                <Input type="number" min={0} step="0.01" value={line.unitPrice} aria-label="Prix unitaire" onChange={e => setLines(l => l.map((x, i) => (i === index ? { ...x, unitPrice: Number(e.target.value) || 0 } : x)))} />
                <Button size="icon" variant="ghost" aria-label="Retirer" onClick={() => setLines(l => l.filter((_, i) => i !== index))}><Trash2 size={15} /></Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <b>{formatCurrency(total, currency)}</b>
            <Button onClick={() => create.mutate()} disabled={!lines.length || lines.some(l => !l.label.trim()) || create.isPending}>Créer la facture</Button>
          </div>
        </DialogContent>
      </Dialog>

      <InvoiceDialog id={invoiceId} onClose={() => setInvoiceId(null)} cabinetApi={cabinetApi} currency={currency} />
      <QuoteDialog id={quoteId} onClose={() => setQuoteId(null)} cabinetApi={cabinetApi} currency={currency} />
    </div>
  )
}
