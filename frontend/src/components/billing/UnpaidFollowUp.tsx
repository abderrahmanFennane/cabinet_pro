import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { MessageCircle, MessageSquare, Send } from 'lucide-react'
import api from '../../lib/api'
import { apiError, useAuth, useCabinetApi } from '../../lib/hooks'
import { cn, formatCurrency, formatDateFR } from '../../lib/utils'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'

type Row = {
  id: string; number: string; date: string; total: number; paid: number; balance: number; days: number
  reminderCount: number; lastReminderAt: string | null; message: string
  patient: { id: string; firstName: string; lastName: string; phone: string | null }
}
type Unpaid = { total: number; buckets: { recent: number; month: number; old: number }; rows: Row[] }

/** wa.me link: opens WhatsApp (phone or WhatsApp Web) with the message ready, sent from the clinic's own number. */
export function whatsappLink(phone: string, text: string) {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = `212${digits.slice(1)}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/** Unpaid balances, oldest first, with a reminder by WhatsApp or SMS. */
export default function UnpaidFollowUp({ onOpenInvoice }: { onOpenInvoice: (id: string) => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const currency = user?.cabinet?.currency || 'MAD'
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const [reminding, setReminding] = useState<Row | null>(null)
  const { data } = useQuery({
    queryKey: ['unpaid', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/billing/unpaid`)).data.data as Unpaid,
  })
  const remind = useMutation({
    mutationFn: ({ row, channel }: { row: Row; channel: 'WHATSAPP' | 'SMS' | 'LINK' }) => api.post(`${cabinetApi}/billing/invoices/${row.id}/remind`, { channel }),
    onSuccess: (r) => { toast.success(r.data.message); setReminding(null); queryClient.invalidateQueries({ queryKey: ['unpaid', cabinetApi] }) },
    onError: (err) => toast.error(apiError(err)),
  })

  const bucket = (label: string, value: number, tone: string) => (
    <div className="grid gap-0.5 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3.5">
      <span className="text-[0.86rem] text-[#5A6B65]">{label}</span>
      <b className={cn('text-[1.3rem] font-extrabold tabular-nums', tone)}>{formatCurrency(value, currency)}</b>
    </div>
  )

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {bucket(t('unpaid.total'), data?.total ?? 0, 'text-[#B8372C]')}
        {bucket(t('unpaid.recent'), data?.buckets.recent ?? 0, '')}
        {bucket(t('unpaid.month'), data?.buckets.month ?? 0, 'text-[#99600B]')}
        {bucket(t('unpaid.old'), data?.buckets.old ?? 0, 'text-[#B8372C]')}
      </div>

      <ul className="overflow-hidden rounded-[14px] border border-[#D8E1DD] bg-white">
        {data && data.rows.length === 0 && <li className="p-6 text-center text-[#5A6B65]">{t('unpaid.none')}</li>}
        {data?.rows.map(row => (
          <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#D8E1DD] px-4 py-3 first:border-t-0">
            <button type="button" className="min-w-0 text-start" onClick={() => onOpenInvoice(row.id)}>
              <p className="flex flex-wrap items-center gap-x-2">
                <b>{row.patient.lastName} {row.patient.firstName}</b>
                <span className={cn('rounded-full px-2 py-0.5 text-[0.74rem] font-bold', row.days > 90 ? 'bg-[#FBE3E0] text-[#B8372C]' : row.days > 30 ? 'bg-[#FBEED6] text-[#99600B]' : 'bg-[#F2F5F3] text-[#5A6B65]')}>
                  {row.days === 0 ? t('unpaid.today') : t('unpaid.days', { count: row.days })}
                </span>
              </p>
              <p className="truncate text-[0.84rem] text-[#5A6B65]">
                {row.number} · {formatDateFR(row.date)} · {t('unpaid.of', { total: formatCurrency(row.total, currency) })}
                {row.reminderCount > 0 && ` · ${t('unpaid.reminded', { count: row.reminderCount, date: formatDateFR(row.lastReminderAt!) })}`}
              </p>
            </button>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold tabular-nums text-[#B8372C]">{formatCurrency(row.balance, currency)}</span>
              <Button size="sm" variant="outline" onClick={() => setReminding(row)} disabled={!row.patient.phone} title={row.patient.phone ? undefined : t('unpaid.noPhone')}>
                <Send size={15} className="me-1.5 rtl:rotate-180" />{t('unpaid.remind')}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!reminding} onOpenChange={open => !open && setReminding(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('unpaid.remindTitle', { name: reminding ? `${reminding.patient.firstName} ${reminding.patient.lastName}` : '' })}</DialogTitle>
            <DialogDescription>{t('unpaid.remindHint')}</DialogDescription>
          </DialogHeader>
          {reminding && (
            <div className="space-y-4">
              <p className="rounded-xl bg-[#F2F5F3] p-3 text-sm" dir="auto">{reminding.message}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild className="bg-[#1E8E4E] hover:bg-[#177A42]">
                  <a href={whatsappLink(reminding.patient.phone!, reminding.message)} target="_blank" rel="noreferrer" onClick={() => remind.mutate({ row: reminding, channel: 'LINK' })}>
                    <MessageCircle size={16} className="me-1.5" />{t('unpaid.openWhatsapp')}
                  </a>
                </Button>
                <Button variant="outline" disabled={remind.isPending} onClick={() => remind.mutate({ row: reminding, channel: 'SMS' })}>
                  <MessageSquare size={16} className="me-1.5" />{t('unpaid.sendSms')}
                </Button>
              </div>
              <p className="text-xs text-[#5A6B65]">{t('unpaid.channelsHint')}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
