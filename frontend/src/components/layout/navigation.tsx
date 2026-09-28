import { useLocation } from 'react-router-dom'
import { Building2, FileClock, Home, Layers, MoreHorizontal, Settings, UserPlus, UsersRound, Wallet } from 'lucide-react'
import { useAuth, useCabinetId } from '../../lib/hooks'
import { Role } from '../../types'
import { PermissionKey } from '../../types/permissions'

export interface NavTab { to: string; labelKey: string; permissions?: PermissionKey[]; roles?: Role[] }

export interface NavItem {
  labelKey: string
  icon: React.ReactNode
  /** Pages grouped under this item; the first one is where the item leads. Shown as tabs on top of the page. */
  tabs: NavTab[]
  permissions?: PermissionKey[]
  roles?: Role[]
}

// Each role sees 3 to 5 items. Related pages share one item and appear as tabs, so the menu stays short.
const cabinetItems: NavItem[] = [
  {
    labelKey: 'nav.today', icon: <Home size={20} />, permissions: ['MANAGE_APPOINTMENTS'],
    tabs: [
      { to: '/today', labelKey: 'nav.today' },
      { to: '/agenda', labelKey: 'nav.agenda' },
      { to: '/dashboard', labelKey: 'today.stats', permissions: ['VIEW_REPORTS'] },
    ],
  },
  { labelKey: 'nav.patients', icon: <UsersRound size={20} />, permissions: ['MANAGE_PATIENTS'], tabs: [{ to: '/patients', labelKey: 'nav.patients' }] },
  { labelKey: 'nav.payments', icon: <Wallet size={20} />, permissions: ['MANAGE_BILLING'], tabs: [{ to: '/billing', labelKey: 'nav.payments' }] },
  // The owner creates his assistants' and colleagues' accounts here, within his plan's limits.
  { labelKey: 'nav.team', icon: <UserPlus size={20} />, permissions: ['MANAGE_TEAM'], roles: [Role.OWNER], tabs: [{ to: '/team', labelKey: 'nav.team' }] },
  {
    labelKey: 'nav.myCabinet', icon: <Settings size={20} />, permissions: ['MANAGE_SETTINGS'], roles: [Role.OWNER, Role.SUPER_ADMIN],
    tabs: [
      { to: '/settings', labelKey: 'nav.settings' },
      { to: '/pricing', labelKey: 'nav.subscription', roles: [Role.OWNER], permissions: ['MANAGE_SUBSCRIPTION'] },
    ],
  },
]

const platformItems: NavItem[] = [
  { labelKey: 'nav.allCabinets', icon: <Building2 size={20} />, tabs: [{ to: '/cabinets', labelKey: 'nav.allCabinets' }] },
  { labelKey: 'adminPage.usersTitle', icon: <UsersRound size={20} />, tabs: [{ to: '/users', labelKey: 'adminPage.usersTitle' }] },
  {
    labelKey: 'nav.plans', icon: <Layers size={20} />,
    tabs: [
      { to: '/plans', labelKey: 'nav.plans' },
      { to: '/invoices', labelKey: 'nav.invoices' },
    ],
  },
  { labelKey: 'nav.audit', icon: <FileClock size={20} />, tabs: [{ to: '/audit', labelKey: 'nav.audit' }] },
  {
    labelKey: 'nav.more', icon: <MoreHorizontal size={20} />,
    tabs: [
      { to: '/superadmin/settings', labelKey: 'nav.settings' },
      { to: '/specialties', labelKey: 'nav.specialties' },
      { to: '/messages', labelKey: 'nav.messages' },
    ],
  },
]

/** Menu of the current user, already filtered by role, plan and permissions. */
export function useNavigation() {
  const { user, hasRole, hasPermissions } = useAuth()
  const cabinetId = useCabinetId()
  const { pathname } = useLocation()
  const superAdmin = user?.role === Role.SUPER_ADMIN
  const inCabinet = !superAdmin || !!cabinetId

  const allowed = (x: { roles?: Role[]; permissions?: PermissionKey[] }) =>
    (!x.roles || hasRole(x.roles)) && (superAdmin || !x.permissions?.length || hasPermissions(x.permissions))

  const items = (inCabinet ? cabinetItems : platformItems)
    .filter(allowed)
    .map(item => ({ ...item, tabs: item.tabs.filter(allowed) }))
    .filter(item => item.tabs.length > 0)
    .map(item => (item.labelKey === 'nav.today' && user?.role === Role.PRACTITIONER ? { ...item, labelKey: 'nav.myDay' }
      : item.labelKey === 'nav.payments' && user?.role === Role.PRACTITIONER ? { ...item, labelKey: 'nav.myPayments' } : item))

  const active = items.find(item => item.tabs.some(tab => pathname === tab.to || pathname.startsWith(`${tab.to}/`)))
  return { items, active, inCabinet }
}
