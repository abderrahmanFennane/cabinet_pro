import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CheckCircle2, FileText, Plus, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { apiError } from '../../lib/hooks'
import { formatCurrency } from '../../lib/utils'
import { TreatmentPlan } from '../../types'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { QuoteDialog, quoteTone } from '../billing/BillingDetails'
import { useL } from '../../lib/labels'

type Props = {
  base: string
  cabinetApi: string
  patientId: string
  plans: TreatmentPlan[]
  currency: string
  onAddAct: (planId: string) => void
}

const planTone = (status: TreatmentPlan['status']) => (status === 'DONE' ? 'success' : status === 'CANCELLED' ? 'secondary' : status === 'PROPOSED' ? 'warning' : 'default') as any

/** F-DEN-06/07: plans with ordered sessions, acts to perform, and a quote generated from the plan. */
export default function TreatmentPlans({ base, cabinetApi, patientId, plans, currency, onAddAct }: Props) {
  const L = useL()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [quoteId, setQuoteId] = useState<string | null>(null)

  const refresh = () => ['dental-plans', 'dental-chart', 'tooth', 'patient', 'timeline'].forEach(key => queryClient.invalidateQueries({ queryKey: [key, patientId] }))

  const create = useMutation({
    mutationFn: () => api.post(`${base}/plans`, { title, notes: notes || null }),
    onSuccess: (res) => {
      toast.success(L('Plan créé : ajoutez-y des actes'))
      setCreating(false); setTitle(''); setNotes('')
      refresh()
      onAddAct(res.data.data.id)
    },
    onError: (err) => toast.error(apiError(err)),
  })
  const perform = useMutation({
    mutationFn: (actId: string) => api.post(`${base}/acts/${actId}/perform`),
    onSuccess: () => { toast.success(L('Acte réalisé')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const removeAct = useMutation({
    mutationFn: (actId: string) => api.delete(`${base}/acts/${actId}`),
    onSuccess: () => { toast.success(L('Acte retiré du plan')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const makeQuote = useMutation({
    mutationFn: (planId: string) => api.post(`${base}/plans/${planId}/quote`, {}),
    onSuccess: (res) => { toast.success(L('Devis créé à partir du plan')); refresh(); setQuoteId(res.data.data.id) },
    onError: (err) => toast.error(apiError(err)),
  })
  const cancelPlan = useMutation({
    mutationFn: (planId: string) => api.patch(`${base}/plans/${planId}`, { status: 'CANCELLED' }),
    onSuccess: () => { toast.success(L('Plan annulé')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{L('Plans de traitement')}</h3>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus size={16} className="me-1" />{L('Nouveau plan')}</Button>
      </div>

      {plans.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{L('Aucun plan de traitement. Créez-en un pour organiser les séances et générer un devis.')}</p>}

      {plans.map(plan => {
        const sessions = [...new Set(plan.acts.map(a => a.session ?? 0))].sort((a, b) => a - b)
        const editable = !['DONE', 'CANCELLED'].includes(plan.status)
        return (
          <article key={plan.id} className="space-y-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold">{plan.title}</h4>
                <p className="text-xs text-muted-foreground">{plan.done}/{plan.acts.length} {L('actes réalisés')} · {formatCurrency(plan.total, currency)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={planTone(plan.status)}>{t(`planStatus.${plan.status}`)}</Badge>
                {plan.quote && <Badge variant={quoteTone(plan.quote.status)}>Devis {plan.quote.number} · {t(`quoteStatus.${plan.quote.status}`)}</Badge>}
              </div>
            </header>
            {plan.notes && <p className="text-sm text-muted-foreground">{plan.notes}</p>}

            {sessions.map(session => (
              <div key={session} className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{session ? `${L('Séance')} ${session}` : L('Sans séance')}</p>
                {plan.acts.filter(a => (a.session ?? 0) === session).map(act => (
                  <div key={act.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 p-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold">{act.teeth && <span className="me-1.5 font-mono text-primary">{act.teeth}</span>}{act.label}{act.faces ? ` · ${act.faces.replace(/,/g, '')}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(act.price, currency)}</p>
                    </div>
                    {act.status === 'DONE' ? (
                      <Badge variant="success">{L('Réalisé')}</Badge>
                    ) : editable && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="secondary" onClick={() => perform.mutate(act.id)} disabled={perform.isPending}><CheckCircle2 size={15} className="me-1" />{L('Réaliser')}</Button>
                        {!plan.quote && <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={L('Retirer l’acte')} onClick={() => removeAct.mutate(act.id)}><Trash2 size={15} /></Button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            <footer className="flex flex-wrap gap-2 border-t border-border pt-3">
              {editable && !plan.quote && <Button size="sm" variant="outline" onClick={() => onAddAct(plan.id)}><Plus size={15} className="me-1" />{L('Ajouter un acte')}</Button>}
              {plan.quote
                ? <Button size="sm" onClick={() => setQuoteId(plan.quote!.id)}><FileText size={15} className="me-1" />{L('Voir le devis')}</Button>
                : editable && plan.acts.length > 0 && <Button size="sm" onClick={() => makeQuote.mutate(plan.id)} disabled={makeQuote.isPending}><FileText size={15} className="me-1" />{L('Générer le devis')}</Button>}
              {editable && plan.done === 0 && <Button size="sm" variant="ghost" onClick={() => cancelPlan.mutate(plan.id)}>{L('Annuler le plan')}</Button>}
            </footer>
          </article>
        )
      })}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L('Nouveau plan de traitement')}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate() }}>
            <div className="space-y-1.5"><Label htmlFor="plan-title">{L('Titre')}</Label><Input id="plan-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={L('ex. Réhabilitation secteur 3')} autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="plan-notes">{L('Notes')}</Label><Textarea id="plan-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={!title.trim() || create.isPending}>{L('Créer et ajouter des actes')}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <QuoteDialog id={quoteId} onClose={() => setQuoteId(null)} cabinetApi={cabinetApi} currency={currency} />
    </section>
  )
}
