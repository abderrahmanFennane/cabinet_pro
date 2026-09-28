import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, CreditCard, Inbox } from 'lucide-react'
import api from '../lib/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { toast } from '../components/ui/toast'
import { useTranslation } from 'react-i18next'
import { EmptyState, PageHeader } from '../components/layout/PageHeader'
import { toneAt } from '../lib/tones'

type Plan = {
  id: string
  code: string
  name: string
  description?: string | null
  monthlyPrice: number
  durationMonths: number
  maxPractitioners: number
  maxAssistants: number
}

export default function Plans() {
  const { t } = useTranslation()
  const subscription = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: async () => (await api.get('/billing/subscription')).data.data,
  })

  const plans = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => ((await api.get('/billing/plans')).data.data || []) as Plan[],
  })

  const checkout = useMutation({
    mutationFn: async (planCode: string) => (await api.post('/billing/checkout', { planCode })).data.data,
    onSuccess: data => { if (data.checkoutUrl) window.location.href = data.checkoutUrl },
    onError: (err: any) => toast({ title: t('common.error'), description: err.response?.data?.message || err.response?.data?.error, variant: 'destructive' }),
  })

  const currentPlanCode = subscription.data?.plan?.code || subscription.data?.cabinet?.plan

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader onBack={() => window.history.back()} title={t('adminPage.planPricing')} subtitle={t('adminPage.planPricingSubtitle')} />

      {!plans.data?.length ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={<Inbox size={26} />} title={t('adminPage.noPlans')} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {plans.data.map((plan, index) => {
            const isCurrent = !!currentPlanCode && String(currentPlanCode).toUpperCase() === String(plan.code).toUpperCase()
            const price = Number(plan.monthlyPrice).toFixed(2)
            return (
              <Card key={plan.id} className={`relative overflow-hidden ${isCurrent ? 'border-primary shadow-[0_22px_40px_-28px_rgba(18,112,90,0.8)]' : ''}`}>
                <span aria-hidden="true" className={`absolute -end-10 -top-10 h-28 w-28 rounded-full opacity-50 ${toneAt(index).soft}`} />
                <CardHeader className="relative space-y-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white shadow-[0_10px_20px_-14px_rgba(18,112,90,0.7)] ${toneAt(index).chip}`}><CreditCard size={20} /></span>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    {isCurrent && <Badge variant="success">{t('adminPage.current')}</Badge>}
                  </div>
                  <div className="space-y-1">
                    <div className="text-4xl font-bold tracking-[-0.04em] text-[#14231E]">
                      {price}
                      <span className="text-base font-medium tracking-normal text-[#5A6B65]"> {t('adminPage.perMonth')}</span>
                    </div>
                    <div className="text-sm text-[#5A6B65]">
                      {t('adminPage.commitment', { months: plan.durationMonths })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative space-y-5">
                  <div className="space-y-2 text-sm text-[#3F514A]">
                    <div className="flex items-center gap-2">
                      <Check size={16} className="text-primary" />
                      {t('adminPage.practitioners', { count: plan.maxPractitioners })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={16} className="text-primary" />
                      {plan.maxAssistants >= 999 ? t('adminPage.assistantsUnlimited') : t('adminPage.assistants', { count: plan.maxAssistants })}
                    </div>
                    {plan.description ? (
                      <div className="pt-2 text-sm text-muted-foreground">
                        {plan.description}
                      </div>
                    ) : null}
                  </div>

                  <Button
                    className="w-full gap-2"
                    size="lg"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={checkout.isPending || isCurrent}
                    onClick={() => checkout.mutate(plan.code)}
                  >
                    <CreditCard size={16} />
                    {isCurrent ? t('adminPage.currentPlan') : t('adminPage.choose')}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
