import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, MessageCircle, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { cn, formatDateTimeFR, formatCurrency, formatDateFR } from '../../lib/utils'
import { BillingInvoice, OutgoingMessage, Cabinet } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { toast } from '../ui/toast'

const statusVariant: Record<string, any> = { SENT: 'success', LOGGED: 'secondary', FAILED: 'destructive', PENDING: 'warning' }

/** Cabinet owner: turn appointment reminders on/off, pick the channel, and see what was sent. */
export function RemindersCard({ cabinet }: { cabinet: Cabinet & { remindersEnabled?: boolean; reminderChannel?: string } }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(cabinet.remindersEnabled ?? true)
  const [channel, setChannel] = useState(cabinet.reminderChannel || 'BOTH')

  useEffect(() => {
    setEnabled(cabinet.remindersEnabled ?? true)
    setChannel(cabinet.reminderChannel || 'BOTH')
  }, [cabinet.remindersEnabled, cabinet.reminderChannel])

  const { data: log = [] } = useQuery({
    queryKey: ['cabinet-reminders', cabinet.id],
    queryFn: async () => ((await api.get(`/messages/cabinet/${cabinet.id}`)).data.data || []) as OutgoingMessage[],
  })

  const save = useMutation({
    mutationFn: (payload: { remindersEnabled?: boolean; reminderChannel?: string }) => api.patch(`/cabinets/${cabinet.id}`, payload),
    onSuccess: () => {
      toast({ title: t('reminders.saved'), variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['cabinet', cabinet.id] })
    },
    onError: (err: any) => toast({ title: t('common.error'), description: err.response?.data?.error, variant: 'destructive' }),
  })

  const options = [
    { value: 'BOTH', label: t('reminders.both'), icon: <BellRing size={17} /> },
    { value: 'WHATSAPP', label: t('reminders.whatsappOnly'), icon: <MessageCircle size={17} /> },
    { value: 'SMS', label: t('reminders.smsOnly'), icon: <Smartphone size={17} /> },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <span className="icon-chip h-9 w-9 rounded-xl bg-[#FFF3D4] text-[#B87700]"><BellRing size={17} /></span>
            {t('reminders.title')}
          </CardTitle>
          <CardDescription>{t('reminders.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-[#F2F5F3] p-4">
            <span className="font-semibold text-[#14231E]">{t('reminders.enabled')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => { setEnabled(!enabled); save.mutate({ remindersEnabled: !enabled }) }}
              className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', enabled ? 'bg-primary' : 'bg-[#D8E1DD]')}
            >
              <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', enabled ? 'start-6' : 'start-1')} />
            </button>
          </label>

          <div className={cn('space-y-2', !enabled && 'pointer-events-none opacity-50')}>
            <p className="text-sm font-semibold text-[#14231E]">{t('reminders.channel')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {options.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setChannel(option.value); save.mutate({ reminderChannel: option.value }) }}
                  className={cn('flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition-colors', channel === option.value ? 'border-primary bg-[#E9EFEC] text-primary' : 'border-[#D8E1DD] text-[#3F514A] hover:bg-[#F2F5F3]')}
                >
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="text-base">{t('reminders.log')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!log.length ? (
            <p className="mx-4 mb-4 rounded-2xl bg-[#F2F5F3] py-6 text-center text-sm text-[#5A6B65] sm:mx-6 sm:mb-6">{t('reminders.empty')}</p>
          ) : (
            <ul className="divide-y divide-[#E3EAE7] border-t border-[#E3EAE7]">
              {log.map(item => (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-6">
                  <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', item.channel === 'SMS' ? 'bg-[#DCEEE7] text-[#12705A]' : 'bg-[#E1FAEC] text-[#087A4B]')}>
                    {item.channel === 'SMS' ? <Smartphone size={15} /> : <MessageCircle size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#14231E]">{item.toPhone}</p>
                      <Badge variant={statusVariant[item.status]}>{t(`messagesPage.statuses.${item.status}`)}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-[#3F514A]">{item.body}</p>
                    <p className="mt-0.5 text-xs text-[#8A9A94]">{formatDateTimeFR(item.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Cabinet owner: their own subscription invoices. */
export function InvoiceHistory() {
  const { t } = useTranslation()
  const { data: invoices = [] } = useQuery({
    queryKey: ['my-invoices'],
    queryFn: async () => ((await api.get('/billing/invoices')).data.data || []) as BillingInvoice[],
  })
  return (
    <Card className="overflow-hidden">
      <CardHeader><CardTitle className="text-base">{t('invoices.history')}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {!invoices.length ? (
          <p className="mx-4 mb-4 rounded-2xl bg-[#F2F5F3] py-6 text-center text-sm text-[#5A6B65] sm:mx-6 sm:mb-6">{t('invoices.empty')}</p>
        ) : (
          <ul className="divide-y divide-[#E3EAE7] border-t border-[#E3EAE7]">
            {invoices.map(invoice => (
              <li key={invoice.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="font-semibold text-[#14231E]">{invoice.plan}</p>
                  <p className="text-xs text-[#5A6B65]">{formatDateFR(invoice.paidAt || invoice.createdAt)}{invoice.periodEnd ? ` → ${formatDateFR(invoice.periodEnd)}` : ''}</p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="font-bold text-[#14231E]">{formatCurrency(Number(invoice.amount), invoice.currency)}</p>
                  <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'FAILED' ? 'destructive' : 'warning'}>{t(`invoices.statuses.${invoice.status}`, invoice.status)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
