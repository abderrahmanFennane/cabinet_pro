import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { formatDateFR } from '../lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from './ui/toast'

export interface SubscriptionTarget {
  id: string
  name: string
  plan?: string | null
  subscriptionStatus?: string | null
  currentPeriodEnd?: string | null
}

const STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'] as const
const METHODS = ['CASH', 'TRANSFER', 'CARD', 'OTHER'] as const
const toDateInput = (date: Date) => date.toISOString().slice(0, 10)

/** Super Admin control for a cabinet's plan, status and period end, with an optional manual payment. */
export function SubscriptionDialog({ cabinet, onOpenChange }: { cabinet: SubscriptionTarget | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState<string>('ACTIVE')
  const [endDate, setEndDate] = useState('')
  const [recordPayment, setRecordPayment] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<string>('CASH')
  const [reference, setReference] = useState('')

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => ((await api.get('/plans')).data.data || []) as any[],
    enabled: !!cabinet,
  })

  useEffect(() => {
    if (!cabinet) return
    setPlan(cabinet.plan || '')
    setStatus(cabinet.subscriptionStatus || 'ACTIVE')
    const end = cabinet.currentPeriodEnd ? new Date(cabinet.currentPeriodEnd) : new Date()
    setEndDate(toDateInput(end))
    setRecordPayment(false)
    setAmount('')
    setReference('')
  }, [cabinet])

  useEffect(() => {
    // Pre-fill the price of the chosen plan when recording a payment.
    const selected = plans.find(p => p.code === plan)
    if (recordPayment && selected && !amount) setAmount(String(Number(selected.monthlyPrice)))
  }, [recordPayment, plan, plans, amount])

  const extend = (days: number, months = 0) => {
    const base = endDate && new Date(endDate) > new Date() ? new Date(endDate) : new Date()
    base.setDate(base.getDate() + days)
    base.setMonth(base.getMonth() + months)
    setEndDate(toDateInput(base))
    if (status === 'PAST_DUE' || status === 'SUSPENDED') setStatus('ACTIVE')
  }

  const save = useMutation({
    mutationFn: async () => api.patch(`/cabinets/${cabinet!.id}/subscription`, {
      plan,
      subscriptionStatus: status,
      // End of the chosen day, so "until the 12th" includes the 12th.
      currentPeriodEnd: new Date(`${endDate}T23:59:59`).toISOString(),
      trialEndsAt: status === 'TRIALING' ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
      payment: recordPayment && Number(amount) > 0 ? { amount: Number(amount), method, reference: reference || null } : null,
    }),
    onSuccess: () => {
      toast({ title: t('subscription.saved'), variant: 'success' })
      for (const key of ['all-cabinets', 'saas-metrics', 'superadmin-dashboard', 'subscription-alerts', 'admin-invoices', 'cabinet', 'subscription-history']) queryClient.invalidateQueries({ queryKey: [key] })
      onOpenChange(false)
    },
    onError: (err: any) => toast({ title: t('common.error'), description: err.response?.data?.error || err.response?.data?.message, variant: 'destructive' }),
  })

  const activePlans = plans.filter(p => p.isActive)

  return (
    <Dialog open={!!cabinet} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('subscription.manage')}</DialogTitle>
          <DialogDescription>
            {cabinet?.name}
            {cabinet?.currentPeriodEnd && <> · {t('subscription.current')} : {t(`subscription.statuses.${cabinet.subscriptionStatus}`, cabinet.subscriptionStatus || '')} → {formatDateFR(cabinet.currentPeriodEnd)}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('subscription.plan')}</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>{activePlans.map(p => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('subscription.status')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(`subscription.statuses.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><CalendarClock size={14} className="text-primary" /> {t('subscription.endsOn')}</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => extend(3)}>{t('subscription.plus3d')}</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => extend(0, 1)}>{t('subscription.plus1m')}</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => extend(0, 12)}>{t('subscription.plus1y')}</Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#D8E1DD] bg-[#F2F5F3] p-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-[#14231E]">
              <input type="checkbox" checked={recordPayment} onChange={e => setRecordPayment(e.target.checked)} className="h-5 w-5 accent-primary" />
              <Wallet size={16} className="text-[#087A4B]" /> {t('subscription.recordPayment')}
            </label>
            {recordPayment && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('subscription.amount')}</Label>
                  <Input type="number" inputMode="decimal" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('subscription.method')}</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{t(`subscription.methods.${m}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>{t('subscription.reference')}</Label>
                  <Input value={reference} onChange={e => setReference(e.target.value)} className="bg-white" />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button disabled={!plan || !endDate || save.isPending} onClick={() => save.mutate()}>{t('subscription.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
