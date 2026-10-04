import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { CheckCircle2, Lock } from 'lucide-react'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi } from '../../lib/hooks'
import { cn, formatCurrency, formatTimeFR } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type CashDay = {
  day: string
  totals: Record<'CASH' | 'CARD' | 'TRANSFER' | 'CHECK', number>
  total: number
  payments: { id: string; paidAt: string; method: string; amount: number; reference: string | null; patient: { firstName: string; lastName: string }; invoiceNumber: string | null }[]
  closing: null | { countedCash: number; expectedCash: number; difference: number; notes: string | null; createdAt: string; closedBy: { title?: string | null; firstName: string; lastName: string } | null }
}

/** End of day: payments recorded by method, then the cash counted in the drawer and the difference. */
export default function CashClosing() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const currency = user?.cabinet?.currency || 'MAD'
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const [day, setDay] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [redo, setRedo] = useState(false)
  const { data } = useQuery({
    queryKey: ['cash-day', cabinetApi, day],
    queryFn: async () => (await api.get(`${cabinetApi}/billing/cash-day`, { params: { day } })).data.data as CashDay,
  })
  useEffect(() => { setCounted(''); setNotes(''); setRedo(false) }, [day])
  const close = useMutation({
    mutationFn: () => api.post(`${cabinetApi}/billing/cash-day`, { day, countedCash: Number(counted.replace(',', '.')), notes: notes || undefined }),
    onSuccess: (r) => { toast.success(r.data.message); setRedo(false); queryClient.invalidateQueries({ queryKey: ['cash-day', cabinetApi, day] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const countedValue = Number(counted.replace(',', '.'))
  const diff = counted !== '' && Number.isFinite(countedValue) && data ? Math.round((countedValue - data.totals.CASH) * 100) / 100 : null
  const closed = data?.closing && !redo

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cash-day">{t('cash.day')}</Label>
          <Input id="cash-day" type="date" value={day} max={format(new Date(), 'yyyy-MM-dd')} onChange={e => e.target.value && setDay(e.target.value)} className="w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(['CASH', 'CARD', 'TRANSFER', 'CHECK'] as const).map(m => (
          <div key={m} className="grid gap-0.5 rounded-[14px] border border-[#D8E1DD] bg-white px-4 py-3">
            <span className="text-[0.84rem] text-[#5A6B65]">{t(`paymentMethod.${m}`)}</span>
            <b className="text-[1.15rem] font-extrabold tabular-nums">{formatCurrency(data?.totals[m] ?? 0, currency)}</b>
          </div>
        ))}
        <div className="grid gap-0.5 rounded-[14px] bg-primary px-4 py-3 text-white">
          <span className="text-[0.84rem] opacity-80">{t('cash.total')}</span>
          <b className="text-[1.15rem] font-extrabold tabular-nums">{formatCurrency(data?.total ?? 0, currency)}</b>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ul className="overflow-hidden rounded-[14px] border border-[#D8E1DD] bg-white text-[0.9rem]">
          {data && data.payments.length === 0 && <li className="p-6 text-center text-[#5A6B65]">{t('cash.noPayments')}</li>}
          {data?.payments.map(p => (
            <li key={p.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#D8E1DD] px-4 py-2.5 first:border-t-0">
              <span className="font-mono text-[#5A6B65]">{formatTimeFR(p.paidAt)}</span>
              <span className="truncate">{p.patient.lastName} {p.patient.firstName}<span className="text-[#5A6B65]"> · {t(`paymentMethod.${p.method}`)}{p.invoiceNumber ? ` · ${p.invoiceNumber}` : ''}</span></span>
              <span className="font-mono font-semibold tabular-nums">{formatCurrency(p.amount, currency)}</span>
            </li>
          ))}
        </ul>

        <section className="grid gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
          <h3 className="flex items-center gap-2 font-bold"><Lock size={17} className="text-primary" />{t('cash.closeTitle')}</h3>
          {closed && data?.closing ? (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold text-primary"><CheckCircle2 size={17} />{t('cash.closedBy', { name: data.closing.closedBy ? practitionerName(data.closing.closedBy) : '—', time: formatTimeFR(data.closing.createdAt) })}</p>
              <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
                <dt className="text-[#5A6B65]">{t('cash.expected')}</dt><dd className="text-end font-mono">{formatCurrency(data.closing.expectedCash, currency)}</dd>
                <dt className="text-[#5A6B65]">{t('cash.counted')}</dt><dd className="text-end font-mono">{formatCurrency(data.closing.countedCash, currency)}</dd>
                <dt className="font-semibold">{t('cash.difference')}</dt>
                <dd className={cn('text-end font-mono font-bold', data.closing.difference === 0 ? 'text-primary' : 'text-[#B8372C]')}>{formatCurrency(data.closing.difference, currency)}</dd>
              </dl>
              {data.closing.notes && <p className="text-sm text-[#5A6B65]">{data.closing.notes}</p>}
              {user?.role === 'OWNER' && <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setRedo(true)}>{t('cash.redo')}</Button>}
            </>
          ) : (
            <form className="grid gap-3" onSubmit={e => { e.preventDefault(); close.mutate() }}>
              <p className="text-sm text-[#5A6B65]">{t('cash.closeHint', { amount: formatCurrency(data?.totals.CASH ?? 0, currency) })}</p>
              <div className="space-y-1.5">
                <Label htmlFor="cash-counted">{t('cash.counted')}</Label>
                <Input id="cash-counted" inputMode="decimal" required value={counted} onChange={e => setCounted(e.target.value)} placeholder="0,00" className="font-mono" />
              </div>
              {diff !== null && (
                <p className={cn('rounded-xl px-3 py-2 text-sm font-semibold', diff === 0 ? 'bg-[#DCEEE7] text-primary' : 'bg-[#FBE3E0] text-[#B8372C]')}>
                  {diff === 0 ? t('cash.noDifference') : t('cash.differenceIs', { amount: formatCurrency(diff, currency) })}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="cash-notes">{t('cash.notes')}</Label>
                <Input id="cash-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('cash.notesPlaceholder')} />
              </div>
              <Button type="submit" disabled={close.isPending || counted === '' || !Number.isFinite(countedValue)}>{t('cash.close')}</Button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
