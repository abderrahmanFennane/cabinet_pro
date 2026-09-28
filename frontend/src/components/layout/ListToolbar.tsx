import { ReactNode } from 'react'
import { LayoutGrid, List, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-primary" />
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="rounded-full bg-white ps-10" />
    </div>
  )
}

// Table/grid switch. Hidden on phones, where lists always render as cards.
export function ViewToggle({ view, onChange }: { view: 'table' | 'grid'; onChange: (view: 'table' | 'grid') => void }) {
  const { t } = useTranslation()
  const item = (value: 'table' | 'grid', icon: ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={view === value}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-all',
        view === value ? 'bg-white text-primary shadow-[0_8px_18px_-12px_rgba(18,112,90,0.6)]' : 'text-[#5A6B65] hover:text-[#12705A]',
      )}
    >
      {icon} {label}
    </button>
  )
  return (
    <div className="hidden items-center gap-1 rounded-2xl bg-[#DCEEE7] p-1 md:flex">
      {item('table', <List size={15} />, t('servicesPage.table'))}
      {item('grid', <LayoutGrid size={15} />, t('servicesPage.grid'))}
    </div>
  )
}

// Round photo with a pastel fallback icon.
export function Thumb({ src, icon, chip = 'bg-[#DCEEE7] text-[#12705A]', className }: { src?: string | null; icon: ReactNode; chip?: string; className?: string }) {
  return (
    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white shadow-[0_10px_20px_-14px_rgba(18,112,90,0.7)]', !src && chip, className)}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : icon}
    </span>
  )
}

// Card wrapper for toolbars (search + filters) so they read as one block.
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border border-[#D8E1DD] bg-[#F2F5F3] p-3 sm:rounded-3xl lg:flex-row lg:items-center', className)}>
      {children}
    </div>
  )
}
