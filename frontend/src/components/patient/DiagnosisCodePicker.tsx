import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import api from '../../lib/api'
import { useCabinetApi, useDebouncedValue } from '../../lib/hooks'
import { Input } from '../ui/input'

type Code = { code: string; label: string; chapter: string | null }

/** ICD-10 (CIM-10) search: type words ("angine", "mal de dos") or the start of a code ("J02"). */
export default function DiagnosisCodePicker({ value, onPick }: { value: string; onPick: (code: Code | null) => void }) {
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const search = useDebouncedValue(term)
  const { data: codes = [] } = useQuery({
    queryKey: ['diagnosis-codes', search],
    queryFn: async () => (await api.get(`${cabinetApi}/diagnosis-codes`, { params: { search } })).data.data as Code[],
    enabled: search.trim().length >= 2,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  })

  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCEEE7] px-3 py-1.5 text-sm font-semibold text-primary">
        <span className="font-mono">{value}</span>
        <button type="button" onClick={() => onPick(null)} aria-label={t('icd.remove')} className="rounded-full p-0.5 hover:bg-white/60"><X size={14} /></button>
      </span>
    )
  }
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#5A6B65]" />
      <Input value={term} onChange={e => { setTerm(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t('icd.placeholder')} className="ps-9" aria-label={t('icd.label')} role="combobox" aria-expanded={open && codes.length > 0} />
      {open && term.trim().length >= 2 && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#D8E1DD] bg-white py-1 shadow-lg">
          {codes.length === 0 && <li className="px-3 py-2 text-sm text-[#5A6B65]">{t('icd.none')}</li>}
          {codes.map(c => (
            <li key={c.code} role="option" aria-selected={false}>
              <button type="button" className="flex w-full items-baseline gap-2.5 px-3 py-2 text-start text-sm hover:bg-[#F2F5F3]"
                onMouseDown={e => e.preventDefault()} onClick={() => { onPick(c); setTerm(''); setOpen(false) }}>
                <span className="w-14 shrink-0 font-mono font-semibold text-primary">{c.code}</span>
                <span>{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
