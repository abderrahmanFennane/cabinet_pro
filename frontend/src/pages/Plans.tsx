import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Mail, MessageCircle, Phone, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { useAuth } from '../lib/hooks'
import { cn, formatDateFR } from '../lib/utils'
import { AppSettings } from '../types'
import { PermissionKey } from '../types/permissions'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { whatsappLink } from './SubscriptionBlocked'

type Plan = {
  id: string
  code: string
  name: string
  description?: string | null
  monthlyPrice: number | string
  maxPractitioners: number
  maxAssistants: number
  monthlyMessages: number
  storageGb: number
  permissions: PermissionKey[] | string | null
}
type Quota = { practitioners: { used: number; limit: number }; assistants: { used: number; limit: number } }

const permsOf = (plan: Plan): PermissionKey[] => (Array.isArray(plan.permissions) ? plan.permissions : JSON.parse(plan.permissions || '[]'))
// What differs between plans, in the words a doctor uses.
const FEATURES: [PermissionKey, string][] = [['DENTAL_TREATMENT_PLAN', 'sub.treat'], ['ADVANCED_STATS', 'sub.stats'], ['MULTI_SPECIALTY', 'sub.multi']]

/** The owner's subscription: current plan and usage, then the other plans. */
export default function Plans() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [contactFor, setContactFor] = useState<Plan | null>(null)

  const { data: subscription } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: async () => (await api.get('/billing/subscription')).data.data as { cabinet: { name: string; plan: string; subscriptionStatus: string; currentPeriodEnd: string | null; trialEndsAt: string | null }; plan: Plan | null },
  })
  const { data: plans = [] } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => ((await api.get('/billing/plans')).data.data || []) as Plan[],
  })
  const { data: quota } = useQuery({
    queryKey: ['team-quota', user?.cabinetId],
    queryFn: async () => (await api.get('/users', { params: { cabinetId: user?.cabinetId } })).data.meta?.quota as Quota | undefined,
    enabled: !!user?.cabinetId,
  })
  const { data: contact } = useQuery({
    queryKey: ['app-settings-public'],
    queryFn: async () => (await api.get('/app-settings/public')).data.data as AppSettings,
  })

  // Online payment when it is configured; otherwise the contact panel below.
  const checkout = useMutation({
    mutationFn: async (plan: Plan) => (await api.post('/billing/checkout', { planCode: plan.code })).data.data,
    onSuccess: (data) => { if (data?.checkoutUrl) window.location.href = data.checkoutUrl },
    onError: (_err, plan) => setContactFor(plan),
  })

  const current = subscription?.plan
  const cabinet = subscription?.cabinet
  const end = cabinet?.subscriptionStatus === 'TRIALING' ? cabinet.trialEndsAt || cabinet.currentPeriodEnd : cabinet?.currentPeriodEnd
  const price = (plan: Plan) => (Number(plan.monthlyPrice) === 0 ? t('sub.free') : t('sub.perMonth', { price: Number(plan.monthlyPrice).toLocaleString('fr-FR').replace(/\s/g, ' ') }))
  const meter = (label: string, used: number, limit: number) => (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-[0.9rem]"><span>{label}</span><span className="font-mono tabular-nums">{used} / {limit >= 999 ? t('sub.unlimited') : limit}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-[#E9EFEC]"><i className="block h-full rounded-full bg-primary" style={{ width: `${limit >= 999 ? 8 : Math.min(100, (used / Math.max(1, limit)) * 100)}%` }} /></div>
    </div>
  )
  const message = contactFor ? t('sub.contactMessage', { plan: contactFor.name, cabinet: cabinet?.name || '' }) : ''
  const whatsapp = contact?.supportWhatsapp || contact?.supportPhone

  return (
    <div className="grid gap-6">
      <PageHeader title={t('sub.title')} subtitle={t('sub.subtitle')} />

      {current && cabinet && (
        <section className="grid gap-5 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-1.5">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{t('sub.current')}</span>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[1.5rem] font-extrabold">{current.name}</h2>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.78rem] font-bold', cabinet.subscriptionStatus === 'ACTIVE' ? 'bg-[#DFF1E6] text-[#1E7A45]' : cabinet.subscriptionStatus === 'TRIALING' ? 'bg-[#E1E9F7] text-[#2D5DAA]' : 'bg-[#FBE3E0] text-[#B8372C]')}>
                <i className="h-[7px] w-[7px] rounded-full bg-current" />{t(`sub.status.${cabinet.subscriptionStatus}`, cabinet.subscriptionStatus)}
              </span>
            </div>
            <p className="text-[#5A6B65]">{price(current)} · {end ? t('sub.until', { date: formatDateFR(end) }) : t('sub.noEnd')}</p>
          </div>
          {quota && (
            <div className="grid content-center gap-3.5">
              {meter(t('sub.practitioners'), quota.practitioners.used, quota.practitioners.limit)}
              {meter(t('sub.assistants'), quota.assistants.used, quota.assistants.limit)}
            </div>
          )}
        </section>
      )}

      {contactFor && (
        <section role="status" className="grid gap-3 rounded-[14px] border border-primary bg-[#DCEEE7] p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[1.08rem] font-bold">{t('sub.contactTitle', { plan: contactFor.name })}</h2>
              <p className="mt-1 text-[0.95rem] text-[#3F514A]">{t('sub.contactText')}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setContactFor(null)} aria-label="Fermer"><X size={17} /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {whatsapp && <Button asChild><a href={`${whatsappLink(whatsapp)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} className="me-1.5" />WhatsApp</a></Button>}
            {contact?.supportPhone && <Button asChild variant="outline"><a href={`tel:${contact.supportPhone}`}><Phone size={16} className="me-1.5" />{contact.supportPhone}</a></Button>}
            {contact?.supportEmail && <Button asChild variant="outline"><a href={`mailto:${contact.supportEmail}?subject=${encodeURIComponent(t('sub.contactTitle', { plan: contactFor.name }))}&body=${encodeURIComponent(message)}`}><Mail size={16} className="me-1.5" />{contact.supportEmail}</a></Button>}
          </div>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-[1.08rem] font-bold">{t('sub.change')}</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3.5">
          {plans.filter(plan => plan.code !== 'TRIAL').map(plan => {
            const isCurrent = plan.code === current?.code
            const perms = permsOf(plan)
            return (
              <article key={plan.id} className={cn('grid content-start gap-4 rounded-[14px] border bg-white p-[18px]', isCurrent ? 'border-primary ring-1 ring-primary' : 'border-[#D8E1DD]')}>
                <div>
                  <h3 className="text-[1.15rem] font-extrabold">{plan.name}</h3>
                  <p className="mt-0.5 font-mono text-[1.05rem] font-semibold tabular-nums">{price(plan)}</p>
                  {plan.description && <p className="mt-1.5 text-[0.88rem] text-[#5A6B65]">{plan.description}</p>}
                </div>
                <ul className="grid gap-2 border-t border-[#D8E1DD] pt-3.5 text-[0.9rem]">
                  <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary" />{t('adminPage.practitioners', { count: plan.maxPractitioners })}</li>
                  <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary" />{plan.maxAssistants >= 999 ? t('adminPage.assistantsUnlimited') : t('adminPage.assistants', { count: plan.maxAssistants })}</li>
                  <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary" />{t('sub.reminders', { count: plan.monthlyMessages })}</li>
                  <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary" />{t('sub.storage', { count: plan.storageGb })}</li>
                  {FEATURES.map(([key, label]) => perms.includes(key)
                    ? <li key={key} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary" />{t(label)}</li>
                    : <li key={key} className="flex gap-2 text-[#8A9A94] line-through decoration-[#C9D6D0]"><X size={16} className="mt-0.5 shrink-0" />{t(label)}</li>)}
                </ul>
                <Button variant={isCurrent ? 'outline' : 'default'} disabled={isCurrent || checkout.isPending} onClick={() => checkout.mutate(plan)}>
                  {isCurrent ? t('sub.yours') : t('sub.choose')}
                </Button>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
