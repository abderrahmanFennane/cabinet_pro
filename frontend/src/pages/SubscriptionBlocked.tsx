import { useMutation, useQuery } from '@tanstack/react-query'
import { Clock3, CreditCard, LogOut, Mail, MessageCircle, Phone, ShieldCheck, ShieldX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { useAuth } from '../lib/hooks'
import { AppSettings, Role } from '../types'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { toast } from '../components/ui/toast'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { formatDateFR } from '../lib/utils'
import { toneAt } from '../lib/tones'
import { postToGateway } from '../lib/gateway'

/** wa.me needs international digits; local Moroccan numbers start with 0. */
export const whatsappLink = (phone: string) => {
  let digits = phone.replace(/[^\d]/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = `212${digits.slice(1)}`
  return `https://wa.me/${digits}`
}

export default function SubscriptionBlocked() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const reason = user?.blocked || 'SUSPENDED'
  const isOwner = user?.role === Role.OWNER
  const endDate = user?.cabinet?.currentPeriodEnd

  const { data: contact } = useQuery({
    queryKey: ['app-settings-public'],
    queryFn: async () => (await api.get('/app-settings/public')).data.data as AppSettings,
  })
  const { data: plans = [] } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => ((await api.get('/billing/plans')).data.data || []) as any[],
    enabled: isOwner && reason !== 'SUSPENDED',
  })

  const checkout = useMutation({
    mutationFn: async (planCode: string) => (await api.post('/billing/checkout', { planCode })).data.data,
    onSuccess: (data: any) => { if (data?.gateway) postToGateway(data.gateway) },
    onError: () => toast({ title: t('blocked.contactUs'), description: t('blocked.onlineUnavailable'), variant: 'destructive' }),
  })

  const Icon = reason === 'SUSPENDED' ? ShieldX : Clock3
  const chip = reason === 'SUSPENDED' ? 'bg-[#FF9EA9] text-[#A51F3A]' : 'bg-[#FFD36A] text-[#0D4A3B]'
  const dot = reason === 'SUSPENDED' ? 'bg-[#FF6370]' : 'bg-[#FFB31A]'

  return (
    <div className="relative isolate min-h-[100dvh] overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-10">
      <span aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 -z-10 h-64 w-64 rounded-full bg-[#DCEEE7]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-36 -z-10 h-72 w-72 rounded-full bg-[#DCEEE7] opacity-80" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-36 -right-32 -z-10 h-64 w-64 rounded-full bg-[#F5EEFF] opacity-70" />

      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold text-[#5A6B65]">{user?.cabinet?.name}</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <Button variant="outline" size="sm" className="gap-2" onClick={logout}><LogOut size={15} /> {t('common.logout')}</Button>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-4xl text-center sm:mt-14">
        <span className={`relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-white shadow-[0_12px_24px_-18px_rgba(18,112,90,0.7)] ${chip}`}>
          <Icon size={40} strokeWidth={2.2} />
          <i aria-hidden="true" className={`absolute -right-2 top-1 h-3 w-3 rounded-full ${dot}`} />
          <i aria-hidden="true" className={`absolute -right-5 top-5 h-2 w-2 rounded-full ${dot}`} />
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-[-0.04em] text-[#14231E] sm:text-4xl">{t(`blocked.${reason}`)}</h1>
        {endDate && reason !== 'SUSPENDED' && <p className="mt-2 text-sm font-semibold text-[#12705A]">{t('blocked.endedOn', { date: formatDateFR(endDate) })}</p>}
        <p className="mx-auto mt-3 max-w-xl text-[#5A6B65] sm:text-lg">{isOwner ? t(`blocked.${reason}Text`) : t('blocked.practitionerText')}</p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#E1FAEC] px-3 py-1 text-xs font-semibold text-[#087A4B]"><ShieldCheck size={14} /> {t('blocked.dataSafe')}</p>
      </div>

      {isOwner && reason !== 'SUSPENDED' && plans.length > 0 && (
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Card key={plan.id} className="relative overflow-hidden">
              <span aria-hidden="true" className={`absolute -end-10 -top-10 h-28 w-28 rounded-full opacity-50 ${toneAt(index).soft}`} />
              <CardContent className="relative space-y-4 p-5">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white ${toneAt(index).chip}`}><CreditCard size={20} /></span>
                <div>
                  <p className="text-lg font-bold text-[#14231E]">{plan.name}</p>
                  <p className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[#14231E]">
                    {Number(plan.monthlyPrice).toFixed(0)} <span className="text-sm font-medium tracking-normal text-[#5A6B65]">MAD {t('blocked.perPeriod', { months: plan.durationMonths })}</span>
                  </p>
                  <p className="mt-1 text-sm text-[#5A6B65]">{plan.maxAssistants} assistant(s) · {plan.maxPractitioners} praticien(s)</p>
                </div>
                <Button className="w-full" size="lg" disabled={checkout.isPending} onClick={() => checkout.mutate(plan.code)}>
                  {t('blocked.choose')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(contact?.supportPhone || contact?.supportWhatsapp || contact?.supportEmail) && (
        <Card className="mx-auto mt-6 max-w-4xl">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-1 h-10 w-1.5 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="font-bold text-[#14231E]">{t('blocked.contactUs')}{contact?.businessName ? ` · ${contact.businessName}` : ''}</p>
                <p className="mt-1 text-sm text-[#5A6B65]">{t('blocked.contactHint')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:shrink-0">
              {contact?.supportWhatsapp && (
                <Button asChild className="gap-2 bg-[#25D366] hover:bg-[#1DA851]">
                  <a href={whatsappLink(contact.supportWhatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={17} /> {t('blocked.whatsapp')}</a>
                </Button>
              )}
              {contact?.supportPhone && (
                <Button asChild variant="outline" className="gap-2">
                  <a href={`tel:${contact.supportPhone}`}><Phone size={16} /> {contact.supportPhone}</a>
                </Button>
              )}
              {contact?.supportEmail && (
                <Button asChild variant="outline" className="gap-2">
                  <a href={`mailto:${contact.supportEmail}`}><Mail size={16} /> {t('blocked.email')}</a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
