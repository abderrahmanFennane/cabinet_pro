import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, RotateCcw } from 'lucide-react'
import api from '../../lib/api'
import { apiError, useAuth, useCabinetApi, useCabinetId, useMediaQuery } from '../../lib/hooks'
import { cn } from '../../lib/utils'
import { DentalChart, Dentition, Patient, TreatmentPlan } from '../../types'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import Odontogram, { OdontogramLegend } from './Odontogram'
import ToothSheet from './ToothSheet'
import ActDialog from './ActDialog'
import TreatmentPlans from './TreatmentPlans'
import { useL, translateText } from '../../lib/labels'

const DENTITIONS: Dentition[] = ['PRIMARY', 'MIXED', 'PERMANENT']

export default function DentalTab({ patient, currency }: { patient: Patient; currency: string }) {
  const L = useL()
  const { t } = useTranslation()
  const { hasPermissions } = useAuth()
  const cabinetId = useCabinetId()
  const cabinetApi = useCabinetApi()
  const base = `${cabinetApi}/patients/${patient.id}/dental`
  const queryClient = useQueryClient()
  const canPlan = hasPermissions('DENTAL_TREATMENT_PLAN')
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [selected, setSelected] = useState<number[]>([])
  const [sheetTooth, setSheetTooth] = useState<number | null>(null)
  const [actOpen, setActOpen] = useState(false)
  const [actPlanId, setActPlanId] = useState<string | null>(null)

  const { data: chart } = useQuery({
    queryKey: ['dental-chart', patient.id],
    queryFn: async () => (await api.get(`${base}/chart`)).data.data as DentalChart,
    refetchInterval: false,
  })
  const { data: plans = [] } = useQuery({
    queryKey: ['dental-plans', patient.id],
    queryFn: async () => (await api.get(`${base}/plans`)).data.data as TreatmentPlan[],
    enabled: canPlan,
    refetchInterval: false,
  })

  const setDentition = useMutation({
    mutationFn: (dentition: Dentition | null) => api.patch(`${base}/dentition`, { dentition }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dental-chart', patient.id] }),
    onError: (err) => toast.error(apiError(err)),
  })

  const onSelect = (tooth: number, additive: boolean) => {
    if (additive) {
      setSelected(list => (list.includes(tooth) ? list.filter(n => n !== tooth) : [...list, tooth]))
      return
    }
    setSelected([tooth])
    setSheetTooth(tooth)
  }

  const openAct = (planId: string | null = null) => {
    setActPlanId(planId)
    setActOpen(true)
  }

  if (!chart) return <p className="py-8 text-center text-sm text-muted-foreground">{L('Chargement du schéma dentaire…')}</p>

  const sheet = sheetTooth !== null && (
    <ToothSheet
      key={sheetTooth}
      base={base}
      cabinetId={cabinetId}
      patientId={patient.id}
      tooth={sheetTooth}
      currency={currency}
      onClose={() => { setSheetTooth(null); setSelected([]) }}
      onAddAct={() => openAct()}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-4 rounded-[14px] border border-[#D8E1DD] bg-white p-4 sm:p-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[1.08rem] font-bold">{L('Touchez une dent pour la mettre à jour')}</h3>
              <p className="text-xs text-muted-foreground">
                Denture {t(`dentition.${chart.dentition}`).toLowerCase()} · {chart.teeth.length} dents
                {chart.forced ? L(' · vue choisie manuellement') : ` · ${L('selon l’âge')}${patient.age !== null ? ` (${patient.age} ${L('ans')})` : ''}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label={L('Denture affichée')} className="flex gap-1 rounded-xl bg-muted p-1">
                {DENTITIONS.map(d => (
                  <button key={d} type="button" aria-pressed={chart.dentition === d} onClick={() => setDentition.mutate(d === chart.autoDentition ? null : d)}
                    className={cn('h-8 rounded-lg px-2.5 text-xs font-semibold', chart.dentition === d ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground')}>
                    {t(`dentition.${d}`)}
                  </button>
                ))}
              </div>
              {chart.forced && (
                <Button size="sm" variant="ghost" onClick={() => setDentition.mutate(null)} title={L('Revenir à la denture selon l’âge')}><RotateCcw size={15} /></Button>
              )}
            </div>
          </div>

          <Odontogram dentition={chart.dentition} states={chart.states} plannedTeeth={chart.plannedTeeth} selected={selected} onSelect={onSelect} />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              {selected.length > 1 ? `${selected.length} ${L('dents sélectionnées')} : ${selected.join(', ')}` : L('Touchez une dent pour ouvrir sa fiche. Maj ou Ctrl + clic pour en sélectionner plusieurs.')}
            </p>
            <Button size="sm" onClick={() => openAct()}><Plus size={16} className="me-1" />{L('Ajouter un acte')}</Button>
          </div>
          <OdontogramLegend />
        </section>

        {/* Desktop/tablet: side panel keeps the chart visible while editing (spec 6.3) */}
        <aside className="hidden rounded-[14px] border border-[#D8E1DD] bg-white p-5 lg:block">
          {(isDesktop && sheet) || <p className="py-10 text-center text-sm text-muted-foreground">{L('Sélectionnez une dent pour voir son état, son historique et ses radios.')}</p>}
        </aside>
      </div>

      {/* Phone: the tooth sheet slides up from the bottom */}
      <Dialog open={sheetTooth !== null && !isDesktop} onOpenChange={(open) => { if (!open) { setSheetTooth(null); setSelected([]) } }}>
        <DialogContent className="lg:hidden">
          <DialogTitle className="sr-only">{translateText('Dent')} {sheetTooth}</DialogTitle>
          {sheet}
        </DialogContent>
      </Dialog>

      {canPlan ? (
        <TreatmentPlans base={base} cabinetApi={cabinetApi} patientId={patient.id} plans={plans} currency={currency} onAddAct={(planId) => openAct(planId)} />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{L('Les plans de traitement, devis et échéanciers sont inclus dans les plans Pro et Clinique.')}</p>
      )}

      <ActDialog
        open={actOpen}
        onOpenChange={setActOpen}
        cabinetApi={cabinetApi}
        base={base}
        patientId={patient.id}
        teeth={selected}
        plans={plans}
        canPlan={canPlan}
        currency={currency}
        defaultPlanId={actPlanId}
      />
    </div>
  )
}
