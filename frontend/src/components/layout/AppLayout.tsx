import { Suspense, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Gift, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Sidebar, { BottomNav, SubNav } from './Sidebar'
import Topbar from './Topbar'
import { useAuth, useCabinetApi, useCabinetId, useTeam } from '../../lib/hooks'
import api from '../../lib/api'
import { pages } from '../../router/pages'

export default function AppLayout() {
  const { user, hasPermissions } = useAuth()
  const queryClient = useQueryClient()
  const cabinetApi = useCabinetApi()
  const { t } = useTranslation()
  const cabinetId = useCabinetId()
  const location = useLocation()
  // Warm the team list (used by every practitioner select) as soon as the app opens.
  useTeam()
  // Same for the treatment catalogue behind the "add treatment" and invoice selects.
  useEffect(() => {
    if (!cabinetId || !hasPermissions(['MANAGE_BILLING'])) return
    void queryClient.prefetchQuery({ queryKey: ['acts', cabinetApi], queryFn: async () => (await api.get(`${cabinetApi}/acts`)).data.data })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabinetId])

  // Once the first screen is up, download the other pages in the background so later navigation is instant.
  useEffect(() => {
    const idle = (window as any).requestIdleCallback || ((fn: () => void) => window.setTimeout(fn, 1500))
    const id = idle(() => Object.values(pages).forEach(load => { void load() }))
    return () => ((window as any).cancelIdleCallback || window.clearTimeout)(id)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-[#F2F5F3] text-foreground">
      <Sidebar />
      <div className="min-h-screen min-w-0 lg:ps-60">
        <Topbar />
        {user?.role === 'SUPER_ADMIN' && cabinetId && (
          <div className="flex items-center justify-center gap-2 border-b border-[#EEE7F8] bg-[#EEE7F8] px-4 py-2 text-center text-sm font-semibold text-[#6746A8]">
            <ShieldCheck size={16} /> Vous consultez ce cabinet en tant que Super Admin. Chaque ouverture de dossier est journalisée et visible par le cabinet.
          </div>
        )}
        {user?.role === 'OWNER' && user.cabinet?.subscriptionStatus === 'TRIALING' && user.cabinet.currentPeriodEnd && (() => {
          const daysLeft = Math.ceil((new Date(user.cabinet.currentPeriodEnd).getTime() - Date.now()) / 86_400_000)
          return (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-[#F4DDB0] bg-[#FBEED6] px-4 py-2 text-center text-sm">
              <span className="flex items-center gap-2 font-semibold text-[#99600B]"><Gift size={16} />{daysLeft <= 0 ? t('trial.bannerToday') : t('trial.banner', { count: daysLeft })}</span>
              <Link to="/pricing" className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-[#0D5A48]">{t('trial.choosePlan')}</Link>
            </div>
          )
        })()}
        <main className="mx-auto w-full min-w-0 max-w-[1180px] overflow-x-hidden px-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-5 sm:px-6 lg:px-8 lg:pb-16 lg:pt-7" key={location.pathname}>
          <SubNav />
          <Suspense fallback={<div className="py-16 text-center text-sm text-[#5A6B65]">Chargement…</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
