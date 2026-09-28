import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import api from '../../lib/api'
import { apiError } from '../../lib/hooks'
import { cn, formatCurrency } from '../../lib/utils'
import { PaymentMethod } from '../../types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'CHECK']

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cabinetApi: string
  patientId: string
  target: { invoiceId?: string; quoteId?: string; label: string; remaining: number }
  currency: string
  suggested?: number
}

/** Cash, card, transfer or check; partial payments allowed, never above the remaining balance. */
export default function PaymentDialog({ open, onOpenChange, cabinetApi, patientId, target, currency, suggested }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')

  useEffect(() => {
    if (open) {
      setAmount(String(Math.min(target.remaining, suggested ?? target.remaining)))
      setMethod('CASH')
      setReference('')
    }
  }, [open, target.remaining, suggested])

  const pay = useMutation({
    mutationFn: () => api.post(`${cabinetApi}/billing/payments`, {
      patientId, invoiceId: target.invoiceId || null, quoteId: target.quoteId || null, method, amount: Number(amount), reference: reference || null,
    }),
    onSuccess: () => {
      toast.success('Paiement enregistré')
      for (const key of ['invoice', 'invoices', 'quote', 'quotes', 'payments', 'patient', 'timeline', 'dashboard']) queryClient.invalidateQueries({ queryKey: [key] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const value = Number(amount)
  const valid = value > 0 && value <= target.remaining + 0.001

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaisser</DialogTitle>
          <DialogDescription>{target.label} · reste à payer {formatCurrency(target.remaining, currency)}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) pay.mutate() }}>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Montant</Label>
            <Input id="amount" type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Mode de paiement</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {METHODS.map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
                  className={cn('h-10 rounded-xl border text-sm font-semibold', method === m ? 'border-primary bg-accent text-primary' : 'border-border hover:bg-muted')}>
                  {t(`paymentMethod.${m}`)}
                </button>
              ))}
            </div>
          </div>
          {(method === 'CHECK' || method === 'TRANSFER') && (
            <div className="space-y-1.5">
              <Label htmlFor="reference">{method === 'CHECK' ? 'Numéro du chèque' : 'Référence du virement'}</Label>
              <Input id="reference" value={reference} onChange={e => setReference(e.target.value)} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={!valid || pay.isPending}>Enregistrer {valid ? formatCurrency(value, currency) : ''}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
