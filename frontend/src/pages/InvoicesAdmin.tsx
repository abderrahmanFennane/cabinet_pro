import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ExternalLink, Inbox, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { formatCurrency, formatDateFR } from '../lib/utils'
import { BillingInvoice } from '../types'
import { EmptyState, PageHeader } from '../components/layout/PageHeader'
import { StatCard } from '../components/dashboard/StatCard'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

const statusVariant: Record<string, any> = { PAID: 'success', PENDING: 'warning', FAILED: 'destructive' }

export function InvoiceStatus({ status }: { status: string }) {
  const { t } = useTranslation()
  return <Badge variant={statusVariant[status] || 'secondary'}>{t(`invoices.statuses.${status}`, status)}</Badge>
}

export default function InvoicesAdmin() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'all' | 'PAID' | 'PENDING' | 'FAILED'>('all')
  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices', status],
    queryFn: async () => (await api.get('/billing/admin/invoices', { params: { status: status === 'all' ? undefined : status } })).data.data as { items: BillingInvoice[]; totals: Record<string, { count: number; amount: number }> },
  })
  const totals = data?.totals || {}
  const items = data?.items || []

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow="Super Admin" title={t('invoices.title')} subtitle={t('invoices.subtitle')} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard icon={<CheckCircle2 size={20} />} label={t('invoices.paidTotal')} value={totals.PAID?.amount ?? 0} currency tone="green" highlight subtitle={`${totals.PAID?.count ?? 0} facture(s)`} />
        <StatCard icon={<Clock3 size={20} />} label={t('invoices.pendingTotal')} value={totals.PENDING?.amount ?? 0} currency tone="amber" subtitle={`${totals.PENDING?.count ?? 0} facture(s)`} />
        <StatCard icon={<XCircle size={20} />} label={t('invoices.failedTotal')} value={totals.FAILED?.amount ?? 0} currency tone="rose" subtitle={`${totals.FAILED?.count ?? 0} facture(s)`} />
      </div>

      <div className="scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-[#DCEEE7] p-1 sm:w-fit">
        {(['all', 'PAID', 'PENDING', 'FAILED'] as const).map(value => (
          <button key={value} type="button" onClick={() => setStatus(value)} className={`h-9 shrink-0 rounded-xl px-4 text-sm font-semibold transition-all ${status === value ? 'bg-white text-primary shadow-[0_8px_18px_-12px_rgba(18,112,90,0.6)]' : 'text-[#5A6B65] hover:text-[#12705A]'}`}>
            {value === 'all' ? t('invoices.all') : t(`invoices.statuses.${value}`)}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4 sm:p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : !items.length ? (
            <EmptyState icon={<Inbox size={26} />} title={t('invoices.empty')} tone="green" />
          ) : (
            <>
              <ul className="divide-y divide-[#E3EAE7] md:hidden">
                {items.map(invoice => (
                  <li key={invoice.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#14231E]">{invoice.cabinetName || '—'}</p>
                      <p className="text-xs text-[#5A6B65]">{invoice.plan} · {formatDateFR(invoice.paidAt || invoice.createdAt)}</p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="font-bold text-[#14231E]">{formatCurrency(Number(invoice.amount), invoice.currency)}</p>
                      <InvoiceStatus status={invoice.status} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('invoices.date')}</TableHead>
                      <TableHead>{t('invoices.cabinet')}</TableHead>
                      <TableHead>{t('invoices.plan')}</TableHead>
                      <TableHead className="text-end">{t('invoices.amount')}</TableHead>
                      <TableHead>{t('invoices.status')}</TableHead>
                      <TableHead>{t('subscription.method')}</TableHead>
                      <TableHead>{t('invoices.paidAt')}</TableHead>
                      <TableHead>{t('invoices.periodEnd')}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(invoice => (
                      <TableRow key={invoice.id}>
                        <TableCell className="text-[#5A6B65]">{formatDateFR(invoice.createdAt)}</TableCell>
                        <TableCell className="font-semibold">{invoice.cabinetName || '—'}</TableCell>
                        <TableCell>{invoice.plan}</TableCell>
                        <TableCell className="text-end font-bold">{formatCurrency(Number(invoice.amount), invoice.currency)}</TableCell>
                        <TableCell><InvoiceStatus status={invoice.status} /></TableCell>
                        <TableCell>
                          {invoice.paymentMethod ? t(`subscription.methods.${invoice.paymentMethod}`, invoice.paymentMethod) : invoice.invoiceUrl ? 'Stripe' : '—'}
                          {invoice.reference && <p className="text-xs text-[#8A9A94]">{invoice.reference}</p>}
                        </TableCell>
                        <TableCell>{invoice.paidAt ? formatDateFR(invoice.paidAt) : '—'}</TableCell>
                        <TableCell>{invoice.periodEnd ? formatDateFR(invoice.periodEnd) : '—'}</TableCell>
                        <TableCell className="text-end">
                          {invoice.invoiceUrl && <a href={invoice.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">{t('invoices.open')} <ExternalLink size={13} /></a>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
