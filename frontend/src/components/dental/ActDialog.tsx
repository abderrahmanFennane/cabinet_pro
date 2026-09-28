import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import api from '../../lib/api'
import { apiError } from '../../lib/hooks'
import { cn, formatCurrency } from '../../lib/utils'
import { Act, Face, TreatmentPlan } from '../../types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { NativeSelect } from '../ui/native-select'

const FACES: Face[] = ['M', 'D', 'O', 'I', 'V', 'L', 'P']

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cabinetApi: string
  base: string
  patientId: string
  teeth: number[]
  plans: TreatmentPlan[]
  canPlan: boolean
  currency: string
  defaultPlanId?: string | null
}

/** Adds a dental act from the catalogue on the selected teeth, either planned or performed now (F-DEN-05, F-DEN-08). */
export default function ActDialog({ open, onOpenChange, cabinetApi, base, patientId, teeth, plans, canPlan, currency, defaultPlanId }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: acts = [] } = useQuery({
    queryKey: ['acts', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/acts`)).data.data as Act[],
    enabled: open,
    refetchInterval: false,
  })
  const dentalActs = useMemo(() => acts.filter(a => a.specialty === 'DENTISTRY'), [acts])
  const byCategory = useMemo(() => {
    const groups = new Map<string, Act[]>()
    for (const act of dentalActs) groups.set(act.category, [...(groups.get(act.category) || []), act])
    return [...groups.entries()]
  }, [dentalActs])

  const [actId, setActId] = useState('')
  const [teethText, setTeethText] = useState('')
  const [quadrant, setQuadrant] = useState(1)
  const [faces, setFaces] = useState<Face[]>([])
  const [price, setPrice] = useState('')
  const [status, setStatus] = useState<'PLANNED' | 'DONE'>('PLANNED')
  const [planId, setPlanId] = useState('')
  const [session, setSession] = useState('')

  useEffect(() => {
    if (!open) return
    setActId('')
    setTeethText(teeth.join(', '))
    setFaces([])
    setPrice('')
    setStatus('PLANNED')
    setPlanId(defaultPlanId || '')
    setSession('')
  }, [open, teeth, defaultPlanId])

  const act = dentalActs.find(a => a.id === actId)
  useEffect(() => { if (act) setPrice(String(Number(act.price))) }, [act])

  const toothCount = teethText.split(/[\s,;]+/).filter(Boolean).length
  const total = act?.scope === 'TOOTH' ? Number(price || 0) * Math.max(1, toothCount) : Number(price || 0)
  const openPlans = plans.filter(p => !['DONE', 'CANCELLED'].includes(p.status))

  const submit = useMutation({
    mutationFn: () => api.post(`${base}/acts`, {
      actId,
      teeth: act?.scope === 'QUADRANT' || act?.scope === 'MOUTH' || act?.scope === 'NONE' ? null : teethText,
      quadrant: act?.scope === 'QUADRANT' ? quadrant : undefined,
      faces: act?.usesFaces ? faces : null,
      price: Number(price || 0),
      status,
      treatmentPlanId: status === 'PLANNED' && planId ? planId : null,
      session: session ? Number(session) : null,
    }),
    onSuccess: () => {
      toast.success(status === 'DONE' ? 'Acte réalisé : dent et facture mises à jour' : 'Acte planifié')
      for (const key of ['dental-chart', 'tooth', 'dental-plans', 'dental-acts', 'patient', 'timeline']) {
        queryClient.invalidateQueries({ queryKey: [key, patientId] })
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const needsTeeth = act && (act.scope === 'TOOTH' || act.scope === 'TEETH')
  const valid = !!act && (!needsTeeth || toothCount > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajouter un acte</DialogTitle>
          <DialogDescription>Choisissez l’acte dans le catalogue du cabinet. Un acte réalisé met à jour la dent et s’ajoute à la facture du jour.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) submit.mutate() }}>
          <div className="space-y-1.5">
            <Label htmlFor="act">Acte</Label>
            <NativeSelect id="act" value={actId} onChange={e => setActId(e.target.value)} required>
              <option value="">Choisir un acte…</option>
              {byCategory.map(([category, list]) => (
                <optgroup key={category} label={category}>
                  {list.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name} ({formatCurrency(a.price, currency)})</option>)}
                </optgroup>
              ))}
            </NativeSelect>
            {act?.resultingState && <p className="text-xs text-muted-foreground">Une fois réalisé, la dent passe en « {t(`toothState.${act.resultingState}`)} ».</p>}
          </div>

          {needsTeeth && (
            <div className="space-y-1.5">
              <Label htmlFor="teeth">Dent(s) — notation FDI</Label>
              <Input id="teeth" value={teethText} onChange={e => setTeethText(e.target.value)} placeholder="ex. 36 ou 35, 36" inputMode="numeric" />
              {act.scope === 'TOOTH' && toothCount > 1 && <p className="text-xs text-muted-foreground">Un acte sera créé par dent ({toothCount}).</p>}
            </div>
          )}
          {act?.scope === 'QUADRANT' && (
            <div className="space-y-1.5">
              <Label htmlFor="quadrant">Quadrant</Label>
              <NativeSelect id="quadrant" value={quadrant} onChange={e => setQuadrant(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(q => <option key={q} value={q}>Quadrant {q}</option>)}
              </NativeSelect>
            </div>
          )}
          {act?.usesFaces && (
            <div className="space-y-1.5">
              <Label>Faces</Label>
              <div className="flex flex-wrap gap-1.5">
                {FACES.map(face => (
                  <button key={face} type="button" title={t(`face.${face}`)} aria-pressed={faces.includes(face)}
                    onClick={() => setFaces(list => (list.includes(face) ? list.filter(f => f !== face) : [...list, face]))}
                    className={cn('min-h-[40px] min-w-[44px] rounded-lg border font-mono text-sm font-bold', faces.includes(face) ? 'border-primary bg-primary text-white' : 'border-border hover:bg-muted')}>
                    {face}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price">Tarif {act?.scope === 'TOOTH' ? 'par dent' : ''}</Label>
              <Input id="price" type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                {(['PLANNED', 'DONE'] as const).map(value => (
                  <button key={value} type="button" onClick={() => setStatus(value)} aria-pressed={status === value}
                    className={cn('h-8 rounded-lg text-sm font-semibold', status === value ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground')}>
                    {value === 'PLANNED' ? 'À planifier' : 'Réalisé'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {status === 'PLANNED' && canPlan && (
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div className="space-y-1.5">
                <Label htmlFor="plan">Plan de traitement</Label>
                <NativeSelect id="plan" value={planId} onChange={e => setPlanId(e.target.value)}>
                  <option value="">Aucun (acte isolé)</option>
                  {openPlans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session">Séance</Label>
                <Input id="session" type="number" min={1} value={session} onChange={e => setSession(e.target.value)} placeholder="1" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm">Total : <b>{formatCurrency(total, currency)}</b></p>
            <Button type="submit" disabled={!valid || submit.isPending}>{status === 'DONE' ? 'Enregistrer l’acte réalisé' : 'Planifier l’acte'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
