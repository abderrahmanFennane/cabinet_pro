import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth, useCabinetId, useCabinetPath } from '../../lib/hooks'
import { Role } from '../../types'
import { getInitials } from '../ui/avatar'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { useNavigation } from './navigation'

export function ToothMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 3C5 3 3.5 5 3.5 7.6c0 2.8 1.4 4.3 1.9 6.9.5 2.8 1 6.5 2.6 6.5 1.9 0 1.6-4.6 4-4.6s2.1 4.6 4 4.6c1.6 0 2.1-3.7 2.6-6.5.5-2.6 1.9-4.1 1.9-6.9C20.5 5 19 3 16.5 3c-2 0-2.8 1-4.5 1S9.5 3 7.5 3z" />
    </svg>
  )
}

/** Desktop menu: a short list of places, what this role can do, and who is signed in. */
export default function Sidebar() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cabinetId = useCabinetId()
  const cabinetPath = useCabinetPath()
  const { items, active, inCabinet } = useNavigation()
  if (!user) return null
  const superAdmin = user.role === Role.SUPER_ADMIN
  const can = t(`can.${user.role}`, { returnObjects: true }) as string[]
  const cannot = t(`can.${user.role}_NOT`, { returnObjects: true }) as string[]

  return (
    <aside className="fixed start-0 top-0 z-30 hidden h-[100dvh] w-60 flex-col gap-5 overflow-y-auto border-e border-[#D8E1DD] bg-white px-3.5 py-5 lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary text-white"><ToothMark /></span>
        <div className="min-w-0">
          <b className="block text-[1.02rem] font-extrabold leading-tight">Cabinet Pro</b>
          <small className="block truncate text-[0.78rem] text-[#5A6B65]">{superAdmin && !cabinetId ? 'Plateforme' : user.cabinet?.name || ''}</small>
        </div>
      </div>

      {superAdmin && cabinetId && (
        <div className="space-y-2 rounded-xl bg-[#FBEED6] p-3 text-xs text-[#99600B]">
          <p className="flex items-center gap-1.5 font-semibold"><ShieldCheck size={14} />{t('nav.support')}</p>
          <Button variant="outline" size="sm" className="w-full justify-start gap-1.5" onClick={() => navigate('/cabinets')}>
            <ArrowLeft size={14} className="rtl:rotate-180" /> {t('nav.backToPlatform')}
          </Button>
        </div>
      )}

      <nav className="grid gap-0.5">
        {items.map(item => (
          <NavLink
            key={item.labelKey}
            to={inCabinet ? cabinetPath(item.tabs[0].to) : item.tabs[0].to}
            className={cn(
              'flex items-center gap-3 rounded-[10px] px-3 py-[11px] font-semibold transition-colors',
              active === item ? 'bg-[#DCEEE7] text-primary' : 'text-[#5A6B65] hover:bg-[#E9EFEC] hover:text-[#14231E]',
            )}
          >
            {item.icon}{t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto grid gap-2 rounded-xl border border-[#D8E1DD] p-3 text-[0.84rem]">
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{t('can.title')}</span>
        <ul className="grid gap-1.5">
          {can.map(line => <li key={line} className="grid grid-cols-[16px_1fr] gap-1.5 leading-snug"><span className="font-extrabold text-[#1E7A45]">✓</span>{line}</li>)}
          {cannot.map(line => <li key={line} className="grid grid-cols-[16px_1fr] gap-1.5 leading-snug"><span className="font-extrabold text-[#B8372C]">✕</span>{line}</li>)}
        </ul>
      </div>

      <div className="flex items-center gap-2.5 px-1.5">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#E9EFEC] text-[0.8rem] font-bold text-primary">
          {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(user.firstName, user.lastName)}
        </span>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[0.88rem] leading-tight">{user.title ? `${user.title} ` : ''}{user.firstName} {user.lastName}</b>
          <small className="text-[0.78rem] text-[#5A6B65]">{t(`roles.${user.role}`)}</small>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-[#5A6B65] hover:text-[#B8372C]" onClick={logout} aria-label={t('nav.logout')} title={t('nav.logout')}>
          <LogOut size={17} className="rtl:rotate-180" />
        </Button>
      </div>
    </aside>
  )
}

/** Phone and tablet menu: the same places as tabs at the bottom of the screen. */
export function BottomNav() {
  const { t } = useTranslation()
  const cabinetPath = useCabinetPath()
  const { items, active, inCabinet } = useNavigation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col border-t border-[#D8E1DD] bg-white px-1 pb-[calc(6px+env(safe-area-inset-bottom,0px))] pt-1.5 lg:hidden">
      {items.map(item => (
        <NavLink
          key={item.labelKey}
          to={inCabinet ? cabinetPath(item.tabs[0].to) : item.tabs[0].to}
          className={cn('grid min-h-[52px] justify-items-center gap-0.5 px-0.5 py-1.5 text-[0.7rem] font-semibold', active === item ? 'text-primary' : 'text-[#5A6B65]')}
        >
          {item.icon}<span className="max-w-full truncate">{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  )
}

/** Tabs between pages that share one menu item (e.g. Today, Agenda, Statistics). */
export function SubNav() {
  const { t } = useTranslation()
  const cabinetPath = useCabinetPath()
  const { active, inCabinet } = useNavigation()
  if (!active || active.tabs.length < 2) return null
  return (
    <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1" aria-label={t(active.labelKey)}>
      {active.tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={inCabinet ? cabinetPath(tab.to) : tab.to}
          end={tab.to === '/today'}
          className={({ isActive }) => cn(
            'shrink-0 rounded-full border px-3.5 py-1.5 text-[0.86rem] font-semibold transition-colors',
            isActive ? 'border-[#14231E] bg-[#14231E] text-white' : 'border-[#D8E1DD] bg-white text-[#5A6B65] hover:text-[#14231E]',
          )}
        >
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}
