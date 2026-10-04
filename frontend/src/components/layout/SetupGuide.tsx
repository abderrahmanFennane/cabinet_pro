import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, Rocket, X } from 'lucide-react'
import api from '../../lib/api'
import { useAuth, useCabinetApi, useCabinetPath } from '../../lib/hooks'
import { cn } from '../../lib/utils'
import { Role } from '../../types'

type Guide = { hidden: boolean; done: number; steps: { key: string; done: boolean; path: string }[] }

/** First steps of a new clinic, shown to the owner until everything is done or the card is closed. */
export default function SetupGuide() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const queryClient = useQueryClient()
  const enabled = user?.role === Role.OWNER && !user.cabinet?.isDemo
  const { data } = useQuery({
    queryKey: ['setup-guide', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/setup-guide`)).data.data as Guide,
    enabled,
  })
  const hide = useMutation({
    mutationFn: () => api.post(`${cabinetApi}/setup-guide/hide`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setup-guide', cabinetApi] }),
  })
  if (!enabled || !data || data.hidden || data.done === data.steps.length) return null
  const next = data.steps.find(s => !s.done)

  return (
    <section className="rounded-[18px] border border-[#D8E1DD] bg-white p-5" aria-labelledby="setup-guide-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DCEEE7] text-primary"><Rocket size={20} /></span>
          <div>
            <h2 id="setup-guide-title" className="font-bold">{t('setupGuide.title')}</h2>
            <p className="text-sm text-[#5A6B65]">{t('setupGuide.progress', { done: data.done, total: data.steps.length })}</p>
          </div>
        </div>
        <button type="button" onClick={() => hide.mutate()} className="rounded-lg p-1.5 text-[#5A6B65] hover:bg-[#F2F5F3]" aria-label={t('setupGuide.hide')} title={t('setupGuide.hide')}><X size={18} /></button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9EFEC]" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(data.done / data.steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {data.steps.map(step => (
          <li key={step.key}>
            <Link to={cabinetPath(step.path)} className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-[#F2F5F3]', step === next && 'bg-[#F2F5F3] font-semibold')}>
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', step.done ? 'border-primary bg-primary text-white' : 'border-[#D8E1DD]')}>
                {step.done && <Check size={14} strokeWidth={3} />}
              </span>
              <span className={cn('flex-1', step.done && 'text-[#5A6B65] line-through')}>{t(`setupGuide.steps.${step.key}`)}</span>
              {!step.done && <ChevronRight size={16} className="text-[#5A6B65] rtl:rotate-180" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
