import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import api from '../lib/api'
import { useAuth, useCabinetApi } from '../lib/hooks'
import { cn, formatCurrency, formatDateFR, formatTimeFR } from '../lib/utils'
import { Invoice, Payment, PaymentMethod, Quote } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { NativeSelect } from '../components/ui/native-select'
import { InvoiceDialog, QuoteDialog, invoiceTone, quoteTone } from '../components/billing/BillingDetails'
import PaymentDialog from '../components/billing/PaymentDialog'
import UnpaidFollowUp from '../components/billing/UnpaidFollowUp'
import CashClosing from '../components/billing/CashClosing'
import ExportDialog from '../components/billing/ExportDialog'
import { FileSpreadsheet } from 'lucide-react'
import { useL } from '../lib/labels'

type Tab = 'today' | 'unpaid' | 'closing' | 'invoices' | 'quotes'
const remaining = (inv: Invoice) => Number(inv.total) - Number(inv.paid)

/** Money in one place: who still owes, what came in today, then the full lists. */
export default function Billing() {
  const L = useL()
  const { t } = useTranslation()
  const { user, hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const currency = user?.cabinet?.currency || 'MAD'
  const [params] = useSearchParams()
  const asked = params.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(asked && ['today', 'unpaid', 'closing', 'invoices', 'quotes'].includes(asked) ? asked : params.get('status') ? 'invoices' : 'today')
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState(params.get('status') || '')
  const [day, setDay] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const canQuote = hasPermissions('DENTAL_TREATMENT_PLAN')
  const mineOnly = user?.role === 'PRACTITIONER'
  const today = day === format(new Date(), 'yyyy-MM-dd')

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', cabinetApi, tab === 'today' ? 'unpaid' : status],
    queryFn: async () => (await api.get(`${cabinetApi}/billing/invoices`, { params: { status: tab === 'today' ? undefined : status || undefined } })).data.data as Invoice[],
    enabled: tab === 'today' || tab === 'invoices',
  })
  const { data: cash } = useQuery({
    queryKey: ['payments', cabinetApi, day],
    queryFn: async () => {
      const from = new Date(`${day}T00:00:00`)
      const to = new Date(from.getTime() + 86_400_000)
      return (await api.get(`${cabinetApi}/billing/payments`, { params: { from: from.toISOString(), to: to.toISOString() } })).data.data as { items: Payment[]; byMethod: Record<PaymentMethod, number>; total: number }
    },
    enabled: tab === 'today',
  })
  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/billing/quotes`)).data.data as Quote[],
    enabled: tab === 'quotes' && canQuote,
  })

  const unpaid = invoices.filter(inv => inv.status === 'OPEN' || inv.status === 'PARTIAL')
  const unpaidTotal = unpaid.reduce((sum, inv) => sum + remaining(inv), 0)
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'today', label: t('billingTabs.today'), show: true },
    { key: 'unpaid', label: t('unpaid.tab'), show: true },
    { key: 'closing', label: t('cash.tab'), show: !mineOnly },
    { key: 'invoices', label: t('billingTabs.invoices'), show: true },
    { key: 'quotes', label: t('billingTabs.quotes'), show: canQuote },
  ]

  const stat = (label: string, value: string, warn = false) => (
    <div className="grid gap-0.5 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3.5">
      <span className="text-[0.86rem] text-[#5A6B65]">{label}</span>
      <b className={cn('text-[1.4rem] font-extrabold tabular-nums tracking-[-0.02em]', warn && 'text-[#B8372C]')}>{value}</b>
    </div>
  )

  const table = (head: string[], rows: React.ReactNode, empty: boolean, emptyText: string) => (
    <div className="overflow-x-auto rounded-[14px] border border-[#D8E1DD] bg-white">
      <table className="w-full min-w-[560px] text-[0.9rem]">
        <thead className="text-[0.72rem] uppercase tracking-[0.07em] text-[#5A6B65]">
          <tr>{head.map((h, i) => <th key={h} className={cn('px-4 py-3 font-bold', i >= 3 && i <= 4 ? 'text-end' : 'text-start')}>{h}</th>)}</tr>
        </thead>
        <tbody>{rows}{empty && <tr><td colSpan={head.length} className="p-6 text-center text-[#5A6B65]">{emptyText}</td></tr>}</tbody>
      </table>
    </div>
  )

  return (
    <div className="grid gap-5">
      <PageHeader title={mineOnly ? t('nav.myPayments') : t('nav.payments')}
        actions={hasPermissions('VIEW_REPORTS') ? <Button variant="outline" onClick={() => setExporting(true)}><FileSpreadsheet size={17} className="me-1.5" />{t('accounting.button')}</Button> : undefined} />
      <ExportDialog open={exporting} onOpenChange={setExporting} />
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-[#D8E1DD]">
        {tabs.filter(x => x.show).map(x => (
          <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)}
            className={cn('-mb-px shrink-0 whitespace-nowrap border-b-[2.5px] px-3.5 py-2.5 font-semibold', tab === x.key ? 'border-primary text-[#14231E]' : 'border-transparent text-[#5A6B65] hover:text-[#14231E]')}>{x.label}</button>
        ))}
      </div>

      {tab === 'unpaid' && <UnpaidFollowUp onOpenInvoice={setInvoiceId} />}
      {tab === 'closing' && <CashClosing />}

      {tab === 'today' && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            {stat(today ? L('Encaissé aujourd’hui') : `${L('Encaissé le')} ${formatDateFR(day)}`, formatCurrency(cash?.total ?? 0, currency))}
            {stat('Paiements', String(cash?.items.length ?? 0))}
            {stat(L('Reste à encaisser'), formatCurrency(unpaidTotal, currency), unpaidTotal > 0)}
          </div>

          <div className="grid items-start gap-[18px] lg:grid-cols-2">
            <section className="rounded-[14px] border border-[#D8E1DD] bg-white">
              <div className="flex items-center justify-between gap-2 px-[18px] pb-2.5 pt-4"><h2 className="text-[1.08rem] font-bold">{L('Factures à encaisser')}</h2><span className="text-[0.86rem] text-[#5A6B65]">{unpaid.length}</span></div>
              {unpaid.length === 0 ? <p className="px-[18px] pb-6 pt-2 text-center text-[#5A6B65]">{L('Tout est encaissé.')}</p> : unpaid.map(inv => (
                <div key={inv.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#D8E1DD] px-4 py-3 sm:px-[18px]">
                  <button type="button" className="min-w-0 text-start" onClick={() => setInvoiceId(inv.id)}>
                    <b className="block truncate font-semibold hover:underline">{inv.patient.firstName} {inv.patient.lastName}</b>
                    <span className="text-[0.86rem] text-[#5A6B65]"><span className="font-mono">{inv.number}</span> · {formatDateFR(inv.date)}</span>
                  </button>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold tabular-nums text-[#B8372C]">{formatCurrency(remaining(inv), currency)}</span>
                    <Button size="sm" onClick={() => setPaying(inv)}>{L('Encaisser')}</Button>
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-[14px] border border-[#D8E1DD] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] pb-2.5 pt-4">
                <h2 className="text-[1.08rem] font-bold">{today ? L('Reçus aujourd’hui') : L('Reçus ce jour-là')}</h2>
                <Input type="date" className="h-9 w-auto" value={day} onChange={e => setDay(e.target.value)} aria-label={L('Jour')} />
              </div>
              {!cash || cash.items.length === 0 ? <p className="px-[18px] pb-6 pt-2 text-center text-[#5A6B65]">{L('Aucun paiement ce jour.')}</p> : (
                <>
                  {cash.items.map(p => (
                    <div key={p.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#D8E1DD] px-4 py-3 sm:px-[18px]">
                      <span className="font-mono text-[0.92rem] font-semibold">{formatTimeFR(p.paidAt)}</span>
                      <div className="min-w-0"><b className="block truncate font-semibold">{p.patient?.firstName} {p.patient?.lastName}</b><span className="text-[0.86rem] text-[#5A6B65]">{t(`paymentMethod.${p.method}`)}{p.reference ? ` · ${p.reference}` : ''}</span></div>
                      <span className="font-mono font-semibold tabular-nums">{formatCurrency(p.amount, currency)}</span>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#D8E1DD] px-[18px] py-3 text-[0.86rem] text-[#5A6B65]">
                    {(Object.keys(cash.byMethod) as PaymentMethod[]).filter(m => cash.byMethod[m] > 0).map(m => <span key={m}>{t(`paymentMethod.${m}`)} <b className="text-[#14231E]">{formatCurrency(cash.byMethod[m], currency)}</b></span>)}
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}

      {tab === 'invoices' && (
        <>
          <NativeSelect className="w-auto" aria-label={L('Statut')} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{L('Toutes les factures')}</option>
            {['OPEN', 'PARTIAL', 'PAID', 'CANCELLED'].map(s => <option key={s} value={s}>{t(`invoiceStatus.${s}`)}</option>)}
          </NativeSelect>
          {table([L('N°'), L('Date'), L('Patient'), L('Total'), L('Reste'), L('Statut')], invoices.map(inv => (
            <tr key={inv.id} className="cursor-pointer border-t border-[#D8E1DD] hover:bg-[#E9EFEC]" onClick={() => setInvoiceId(inv.id)}>
              <td className="px-4 py-3 font-mono">{inv.number}</td>
              <td className="px-4 py-3">{formatDateFR(inv.date)}</td>
              <td className="px-4 py-3">{inv.patient.firstName} {inv.patient.lastName}</td>
              <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(inv.total, currency)}</td>
              <td className="px-4 py-3 text-end font-semibold tabular-nums">{formatCurrency(remaining(inv), currency)}</td>
              <td className="px-4 py-3"><Badge variant={invoiceTone(inv.status)}>{t(`invoiceStatus.${inv.status}`)}</Badge></td>
            </tr>
          )), invoices.length === 0, L('Aucune facture.'))}
        </>
      )}

      {tab === 'quotes' && table([L('N°'), L('Date'), L('Patient'), L('Total'), L('Reste'), L('Statut')], quotes.map(q => (
        <tr key={q.id} className="cursor-pointer border-t border-[#D8E1DD] hover:bg-[#E9EFEC]" onClick={() => setQuoteId(q.id)}>
          <td className="px-4 py-3 font-mono">{q.number}</td>
          <td className="px-4 py-3">{formatDateFR(q.date)}</td>
          <td className="px-4 py-3">{q.patient.firstName} {q.patient.lastName}</td>
          <td className="px-4 py-3 text-end tabular-nums">{formatCurrency(q.total, currency)}</td>
          <td className="px-4 py-3 text-end font-semibold tabular-nums">{q.status === 'ACCEPTED' ? formatCurrency(q.remaining, currency) : '—'}</td>
          <td className="px-4 py-3"><Badge variant={quoteTone(q.status)}>{t(`quoteStatus.${q.status}`)}</Badge></td>
        </tr>
      )), quotes.length === 0, L('Aucun devis.'))}

      <InvoiceDialog id={invoiceId} onClose={() => setInvoiceId(null)} cabinetApi={cabinetApi} currency={currency} />
      <QuoteDialog id={quoteId} onClose={() => setQuoteId(null)} cabinetApi={cabinetApi} currency={currency} />
      {paying && (
        <PaymentDialog
          open
          onOpenChange={(open) => { if (!open) setPaying(null) }}
          cabinetApi={cabinetApi}
          patientId={paying.patient.id}
          target={{ invoiceId: paying.id, label: `${L('Facture')} ${paying.number}`, remaining: remaining(paying) }}
          currency={currency}
        />
      )}
    </div>
  )
}
