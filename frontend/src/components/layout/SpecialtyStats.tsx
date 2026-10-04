import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import api from '../../lib/api'
import { useCabinetApi, useCabinetPath } from '../../lib/hooks'
import { cn } from '../../lib/utils'

type Stat = { key: string; value: number; tone?: 'good' | 'warn' | 'bad'; patients?: { id: string; name: string; detail: string }[] }
type Group = { specialty: string; stats: Stat[] }

const TONE: Record<string, string> = { good: 'text-primary', warn: 'text-[#99600B]', bad: 'text-[#B8372C]' }

/** Key numbers of each specialty of the cabinet, with the patients behind each alert. */
export default function SpecialtyStats() {
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const [open, setOpen] = useState<string | null>(null)
  const { data = [] } = useQuery({
    queryKey: ['specialty-stats', cabinetApi],
    queryFn: async () => (await api.get(`${cabinetApi}/specialty-stats`)).data.data as Group[],
    staleTime: 5 * 60_000,
  })
  if (!data.length) return null

  return (
    <div className="space-y-4">
      {data.map(group => (
        <section key={group.specialty} className="rounded-[14px] border border-[#D8E1DD] bg-white p-4">
          <h3 className="mb-3 font-bold">{t(`specialty.${group.specialty}`)}</h3>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {group.stats.map(stat => {
              const id = `${group.specialty}.${stat.key}`
              const list = stat.patients?.length ? stat.patients : null
              return (
                <div key={stat.key} className="rounded-xl bg-[#F7FAF8] p-3">
                  <button type="button" disabled={!list} onClick={() => setOpen(open === id ? null : id)} className="flex w-full items-start justify-between gap-2 text-start disabled:cursor-default">
                    <span>
                      <span className={cn('block text-2xl font-extrabold tabular-nums', stat.tone && stat.value ? TONE[stat.tone] : '')}>
                        {stat.value}{stat.key === 'quoteAcceptance' ? ' %' : ''}
                      </span>
                      <span className="text-[0.84rem] text-[#5A6B65]">{t(`specialtyStats.${group.specialty}.${stat.key}`)}</span>
                    </span>
                    {list && <ChevronDown size={16} className={cn('mt-1 shrink-0 text-[#5A6B65] transition-transform', open === id && 'rotate-180')} />}
                  </button>
                  {list && open === id && (
                    <ul className="mt-2 space-y-1 border-t border-[#D8E1DD] pt-2 text-[0.84rem]">
                      {list.map(p => (
                        <li key={p.id + p.detail}>
                          <Link to={cabinetPath(`/patients/${p.id}`)} className="font-semibold text-primary hover:underline">{p.name}</Link>
                          <span className="text-[#5A6B65]"> · {p.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
