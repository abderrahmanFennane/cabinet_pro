import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Login from '../pages/Login'
import NotFound from '../pages/NotFound'
import PermissionDenied from '../pages/PermissionDenied'
import { pages } from './pages'

const Dashboard = lazy(pages.Dashboard)
const Today = lazy(pages.Today)
const Agenda = lazy(pages.Agenda)
const WaitingRoom = lazy(pages.WaitingRoom)
const Patients = lazy(pages.Patients)
const PatientRecord = lazy(pages.PatientRecord)
const Billing = lazy(pages.Billing)
const Settings = lazy(pages.Settings)
const Users = lazy(pages.Users)
const Pricing = lazy(pages.Pricing)
const CabinetList = lazy(pages.CabinetList)
const CabinetDetail = lazy(pages.CabinetDetail)
const PlansAdmin = lazy(pages.PlansAdmin)
const SpecialtiesAdmin = lazy(pages.SpecialtiesAdmin)
const SuperAdminSettings = lazy(pages.SuperAdminSettings)
const MessagesAdmin = lazy(pages.MessagesAdmin)
const AuditLog = lazy(pages.AuditLog)
const InvoicesAdmin = lazy(pages.InvoicesAdmin)
const PrintPrescription = lazy(() => pages.Print().then(m => ({ default: m.PrintPrescription })))
const PrintDocument = lazy(() => pages.Print().then(m => ({ default: m.PrintDocument })))
const PrintInvoice = lazy(() => pages.Print().then(m => ({ default: m.PrintInvoice })))
const CareSheet = lazy(pages.CareSheet)
const Account = lazy(pages.Account)
const SharedDocument = lazy(pages.SharedDocument)
const PatientFilePrint = lazy(pages.PatientFilePrint)
const ChildBooklet = lazy(pages.ChildBooklet)
const PlatformHome = lazy(pages.PlatformHome)
const PrintQuote = lazy(() => pages.Print().then(m => ({ default: m.PrintQuote })))
const Landing = lazy(pages.Landing)
const TrialRequests = lazy(pages.TrialRequests)
const BookingHome = lazy(() => pages.Booking().then(m => ({ default: m.BookingHome })))
const BookingList = lazy(() => pages.Booking().then(m => ({ default: m.BookingList })))
const BookingCabinetPage = lazy(() => pages.Booking().then(m => ({ default: m.BookingCabinetPage })))
const DoctorPage = lazy(pages.DoctorPage)

import { useAuth, useCabinetId } from '../lib/hooks'
import { Role } from '../types'
import { PermissionKey } from '../types/permissions'

type Props = {
  children: React.ReactNode
  roles?: Role[]
  permissions?: PermissionKey[]
  /** Page inside a cabinet: the Super Admin needs a ?cabinetId= (demo or support access). */
  cabinet?: boolean
}

function ProtectedRoute({ children, roles, permissions, cabinet }: Props) {
  const { isAuthenticated, hasRole, hasPermissions, user } = useAuth()
  const cabinetId = useCabinetId()
  if (!isAuthenticated) return <Navigate to="/admin" replace />
  if (roles && !hasRole(roles)) return <Navigate to="/404" replace />
  if (cabinet && user?.role === Role.SUPER_ADMIN && !cabinetId) return <Navigate to="/cabinets" replace />
  if (permissions?.length && !hasPermissions(permissions)) return <Navigate to="/403" replace />
  return <>{children}</>
}

function RedirectHome() {
  const { user, hasPermissions } = useAuth()
  if (!user) return <Navigate to="/admin" replace />
  if (user.role === Role.SUPER_ADMIN) return <Navigate to="/platform" replace />
  if (hasPermissions('MANAGE_APPOINTMENTS')) return <Navigate to="/today" replace />
  return <Navigate to="/patients" replace />
}

/** Old /login links (bookmarks, messages already sent) go to /admin, keeping the query string. */
function LoginRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/admin${search}`} replace />
}

function Home() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <RedirectHome /> : <Landing />
}

const CABINET_ROLES = [Role.OWNER, Role.PRACTITIONER, Role.ASSISTANT, Role.SUPER_ADMIN]

export default function AppRouter() {
  const inCabinet = (element: React.ReactNode, permissions?: PermissionKey[], roles: Role[] = CABINET_ROLES) => (
    <ProtectedRoute cabinet roles={roles} permissions={permissions}>{element}</ProtectedRoute>
  )
  const platform = (element: React.ReactNode) => <ProtectedRoute roles={[Role.SUPER_ADMIN]}>{element}</ProtectedRoute>

  return (
    <Suspense fallback={null}>
    <Routes>
      {/* Staff sign-in; the old address still works */}
      <Route path="/admin" element={<Login />} />
      <Route path="/login" element={<LoginRedirect />} />
      {/* Document sent to a patient by link: public, protected by the patient's date of birth */}
      <Route path="/d/:token" element={<SharedDocument />} />
      <Route path="/403" element={<PermissionDenied />} />
      {/* Online booking by patients, no account: specialties, cabinets of a specialty, then a cabinet's free slots */}
      <Route path="/rdv" element={<BookingHome />} />
      <Route path="/rdv/:specialty" element={<BookingList />} />
      <Route path="/rdv/:specialty/:cabinet" element={<BookingCabinetPage />} />
      {/* A doctor's public page, and its booking page */}
      <Route path="/rdv/:specialty/:cabinet/:doctor" element={<DoctorPage />} />
      <Route path="/rdv/:specialty/:cabinet/:doctor/reserver" element={<DoctorPage />} />

      {/* Printable documents, outside the app shell */}
      <Route path="/print/prescription/:patientId/:id" element={inCabinet(<PrintPrescription />)} />
      <Route path="/print/child-booklet/:patientId" element={inCabinet(<ChildBooklet />, ['VIEW_MEDICAL'])} />
      <Route path="/print/patient/:patientId" element={inCabinet(<PatientFilePrint />, ['VIEW_MEDICAL'])} />
      <Route path="/print/document/:patientId/:id" element={inCabinet(<PrintDocument />)} />
      <Route path="/print/invoice/:id" element={inCabinet(<PrintInvoice />, ['MANAGE_BILLING'])} />
      <Route path="/print/care-sheet/:invoiceId" element={inCabinet(<CareSheet />, ['MANAGE_BILLING'])} />
      <Route path="/print/quote/:id" element={inCabinet(<PrintQuote />, ['DENTAL_TREATMENT_PLAN'])} />

      {/* Visitors: public home page with the trial request form; signed-in users: their usual home */}
      <Route path="/" element={<Home />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="today" element={inCabinet(<Today />, ['MANAGE_APPOINTMENTS'])} />
        <Route path="dashboard" element={inCabinet(<Dashboard />, ['VIEW_REPORTS'])} />
        <Route path="agenda" element={inCabinet(<Agenda />, ['MANAGE_APPOINTMENTS'])} />
        <Route path="waiting-room" element={inCabinet(<WaitingRoom />, ['MANAGE_APPOINTMENTS'])} />
        <Route path="patients" element={inCabinet(<Patients />, ['MANAGE_PATIENTS'])} />
        <Route path="patients/:patientId" element={inCabinet(<PatientRecord />, ['MANAGE_PATIENTS'])} />
        <Route path="billing" element={inCabinet(<Billing />, ['MANAGE_BILLING'])} />
        <Route path="settings" element={inCabinet(<Settings />, ['MANAGE_SETTINGS'], [Role.OWNER, Role.SUPER_ADMIN])} />
        <Route path="team" element={<ProtectedRoute roles={[Role.OWNER]} permissions={['MANAGE_TEAM']}><Users /></ProtectedRoute>} />
        <Route path="account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="pricing" element={<ProtectedRoute roles={[Role.OWNER]} permissions={['MANAGE_SUBSCRIPTION']}><Pricing /></ProtectedRoute>} />

        <Route path="platform" element={platform(<PlatformHome />)} />
        <Route path="cabinets" element={platform(<CabinetList />)} />
        <Route path="cabinets/:id" element={platform(<CabinetDetail />)} />
        <Route path="users" element={platform(<Users />)} />
        <Route path="plans" element={platform(<PlansAdmin />)} />
        <Route path="specialties" element={platform(<SpecialtiesAdmin />)} />
        <Route path="invoices" element={platform(<InvoicesAdmin />)} />
        <Route path="messages" element={platform(<MessagesAdmin />)} />
        <Route path="audit" element={platform(<AuditLog />)} />
        <Route path="superadmin/settings" element={platform(<SuperAdminSettings />)} />
        <Route path="trial-requests" element={platform(<TrialRequests />)} />
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}
