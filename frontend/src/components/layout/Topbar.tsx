import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Stethoscope,
  LogOut,
  Building2,
  ChevronDown,
  UserRound,
} from 'lucide-react'
import { useAuth, useCabinetId } from '../../lib/hooks'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { getInitials } from '../ui/avatar'
import api from '../../lib/api'
import { AppSettings, Cabinet } from '../../types'
import LanguageSwitcher from './LanguageSwitcher'
import NotificationBell from './NotificationBell'

export default function Topbar() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const cabinetId = useCabinetId()
  const navigate = useNavigate()

  const { data: cabinet } = useQuery({
    queryKey: ['cabinet', cabinetId],
    queryFn: async () => {
      if (!cabinetId) return null
      const { data } = await api.get(`/cabinets/${cabinetId}`)
      return (data.data || data) as Cabinet
    },
    enabled: !!cabinetId,
  })

  const { data: appSettings, isLoading: appSettingsLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data } = await api.get('/app-settings')
      return (data.data || data) as AppSettings
    },
    enabled: user?.role === 'SUPER_ADMIN' && !cabinetId,
  })

  const handleLogout = () => {
    logout()
    navigate('/admin')
  }

  return (
    <>
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-[#E3EAE7] bg-[#F2F5F3]/90 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 min-w-0">
            {cabinet && (
              <div className="flex items-center gap-2 text-foreground min-w-0">
                {cabinet.logo ? (
                  <img
                    src={cabinet.logo}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full border-2 border-white object-cover shadow-[0_8px_16px_-10px_rgba(18,112,90,0.6)]"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DCEEE7] text-[#12705A]"><Building2 size={17} /></span>
                )}
                <span className="truncate text-base font-bold tracking-[-0.03em] text-[#14231E] sm:text-lg">{cabinet.name}</span>
              </div>
            )}
            {!cabinetId && user?.role === 'SUPER_ADMIN' && (
              appSettingsLoading ? (
                <div className="h-5 w-32 bg-muted animate-pulse rounded" />
              ) : (
                <div className="flex items-center gap-2 text-foreground min-w-0">
                  {appSettings?.businessLogo ? (
                    <img
                      src={appSettings.businessLogo}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full border-2 border-white object-cover shadow-[0_8px_16px_-10px_rgba(18,112,90,0.6)]"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DCEEE7] text-[#12705A]"><Stethoscope size={17} /></span>
                  )}
                  <span className="truncate text-base font-bold tracking-[-0.03em] text-[#14231E] sm:text-lg">{appSettings?.businessName || t('dashboard.global')}</span>
                </div>
              )
            )}
            {!cabinet && cabinetId && (
              <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-4 shrink-0">
            <LanguageSwitcher compact />
            {user?.role === 'OWNER' && <NotificationBell />}
            {user && (
              <div className="lg:hidden"><DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-auto gap-2 rounded-full p-1 pe-1.5 sm:pe-3">
                    <Avatar className="h-9 w-9 border-2 border-white shadow-[0_8px_16px_-10px_rgba(18,112,90,0.6)]">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" />
                      ) : (
                        <AvatarFallback className="bg-[#DCEEE7] font-bold text-[#12705A]">
                          {getInitials(user.firstName, user.lastName)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="hidden sm:flex flex-col items-start text-left">
                      <span className="text-sm font-semibold text-[#14231E]">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="text-xs text-[#5A6B65]">
                        {t(`roles.${user.role}`)}
                      </span>
                    </div>
                    <ChevronDown size={16} className="hidden text-[#5A6B65] sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl border-[#D8E1DD] p-1.5 shadow-[0_18px_40px_-20px_rgba(18,112,90,0.45)]">
                  <DropdownMenuLabel>
                    {user.firstName} {user.lastName}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/account')} className="cursor-pointer">
                    <UserRound size={16} className="me-2" />
                    {t('account.menu')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-700 focus:text-red-700 cursor-pointer focus:bg-red-600/10"
                  >
                    <LogOut size={16} className="mr-2" />
                    {t('common.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu></div>
            )}
          </div>
        </div>
      </header>

    </>
  )
}
