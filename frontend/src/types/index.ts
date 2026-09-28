import { PermissionKey } from './permissions'

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OWNER = 'OWNER',
  PRACTITIONER = 'PRACTITIONER',
  ASSISTANT = 'ASSISTANT',
}

export type Specialty = 'DENTISTRY' | 'GENERAL' | 'PEDIATRICS' | 'GYNECOLOGY' | 'OPHTHALMOLOGY' | 'CARDIOLOGY' | 'DERMATOLOGY' | 'PHYSIOTHERAPY' | 'PSYCHIATRY'

export type BlockedReason = 'TRIAL_ENDED' | 'PLAN_EXPIRED' | 'SUSPENDED'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  title?: string | null
  phone?: string | null
  avatar?: string | null
  role: Role
  specialty?: Specialty | null
  seesAllPatients?: boolean
  cabinetId?: string | null
  cabinet?: {
    id: string
    name: string
    specialty: Specialty
    plan: string
    subscriptionStatus: string
    trialEndsAt: string | null
    currentPeriodEnd: string | null
    isActive: boolean
    isDemo: boolean
    currency: string
  } | null
  permissions?: PermissionKey[]
  blocked?: BlockedReason | null
  isActive?: boolean
  createdAt?: string
}

export interface TeamMember {
  id: string
  firstName: string
  lastName: string
  title: string | null
  role: Role
  specialty: Specialty | null
}

// ─── Platform ───

export interface InboxMessage {
  id: string
  kind: string
  subject: string | null
  body: string
  fromName: string | null
  fromPhone: string | null
  readAt: string | null
  createdAt: string
}

export interface OutgoingMessage {
  id: string
  cabinetId: string | null
  cabinetName?: string | null
  kind: string
  channel: 'SMS' | 'WHATSAPP' | 'IN_APP'
  toPhone: string | null
  fromName: string | null
  subject: string | null
  body: string
  status: 'PENDING' | 'SENT' | 'LOGGED' | 'FAILED'
  error: string | null
  createdAt: string
  sentAt: string | null
}

export interface BillingInvoice {
  id: string
  cabinetId: string
  cabinetName?: string | null
  plan: string
  amount: number | string
  currency: string
  status: 'PAID' | 'PENDING' | 'FAILED' | string
  invoiceUrl: string | null
  paymentMethod?: string | null
  reference?: string | null
  periodEnd: string | null
  createdAt: string
  paidAt: string | null
}

export interface SaasCabinetRef {
  id: string
  name: string
  phone: string | null
  email: string | null
  plan: string
  subscriptionStatus: string
  currentPeriodEnd: string | null
}

export interface SaasMetrics {
  counts: { total: number; trialing: number; paying: number; expired: number; suspended: number; newThisMonth: number }
  mrr: number
  collectedThisMonth: number
  revenueByMonth: { month: string; total: number }[]
  byPlan: { plan: string; name: string; cabinets: number; mrr: number }[]
  bySpecialty: { specialty: Specialty; cabinets: number; paying: number; mrr: number }[]
  trialConversion: { trials: number; converted: number; rate: number }
  trialsEndingSoon: SaasCabinetRef[]
  renewalsDueSoon: SaasCabinetRef[]
  recentlyExpired: SaasCabinetRef[]
}

export interface Cabinet {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  logo: string | null
  letterhead: string | null
  currency: string
  specialty: Specialty
  isDemo: boolean
  isActive?: boolean
  plan?: string
  subscriptionStatus?: string
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
  maxPractitioners?: number
  maxAssistants?: number
  monthlyMessages?: number
  remindersEnabled?: boolean
  reminderChannel?: string
  reminderLeadMinutes?: number[]
  supportAccess?: { expiresAt: string; readOnly: boolean } | null
  _count?: { users: number; patients: number }
  createdAt: string
  updatedAt: string
}

export interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  monthlyPrice: number | string
  durationMonths: number
  maxPractitioners: number
  maxAssistants: number
  monthlyMessages: number
  storageGb: number
  permissions: PermissionKey[] | null
  isActive: boolean
}

export interface AppSettings {
  businessName: string | null
  businessLogo: string | null
  supportPhone?: string | null
  supportEmail?: string | null
  supportWhatsapp?: string | null
}

// ─── Patients and agenda ───

export type Coverage = 'CNSS' | 'CNOPS' | 'AMO_TADAMON' | 'FAR' | 'MUTUELLE' | 'PRIVATE' | 'NONE'
export const COVERAGES: Coverage[] = ['CNSS', 'CNOPS', 'AMO_TADAMON', 'FAR', 'MUTUELLE', 'PRIVATE', 'NONE']
export type Dentition = 'PRIMARY' | 'MIXED' | 'PERMANENT'

export interface Patient {
  id: string
  firstName: string
  lastName: string
  sex: 'F' | 'M' | null
  birthDate: string | null
  age: number | null
  cin: string | null
  phone: string | null
  email: string | null
  address: string | null
  coverage: Coverage
  coverageNumber: string | null
  insuredName: string | null
  complementaryInsurance: string | null
  complementaryNumber: string | null
  primaryPractitionerId: string | null
  consentDataAt: string | null
  consentRemindersAt: string | null
  notes: string | null
  createdAt: string
  // Medical fields, present only for practitioners.
  bloodGroup?: string | null
  medicalHistory?: string | null
  surgicalHistory?: string | null
  familyHistory?: string | null
  currentTreatments?: string | null
  allergies?: string | null
  dentition?: Dentition | null
  autoDentition?: Dentition
  balanceDue?: number
  nextAppointment?: Appointment | null
}

export type AppointmentStatus = 'PLANNED' | 'CONFIRMED' | 'ARRIVED' | 'IN_CONSULTATION' | 'DONE' | 'CANCELLED' | 'NO_SHOW'

export interface Appointment {
  id: string
  patientId: string | null
  practitionerId: string
  date: string
  durationMinutes: number
  type: string
  reason: string | null
  status: AppointmentStatus
  walkIn: boolean
  arrivedAt: string | null
  startedAt: string | null
  completedAt: string | null
  waitingMinutes?: number | null
  patient: { id: string; firstName: string; lastName: string; phone: string | null; birthDate: string | null } | null
  practitioner: TeamMember
}

export interface Vitals {
  systolic?: number
  diastolic?: number
  pulse?: number
  weight?: number
  height?: number
  temperature?: number
  glucose?: number
  spo2?: number
}

export interface Consultation {
  id: string
  patientId: string
  practitionerId: string
  appointmentId: string | null
  specialty: Specialty
  date: string
  reason: string | null
  examination: string | null
  vitals: Vitals | null
  diagnosis: string | null
  plan: string | null
  notes: string | null
  status: 'DRAFT' | 'LOCKED'
  lockedAt: string | null
  version: number
  practitioner: TeamMember
  revisions?: { id: string; version: number; createdAt: string; authorId: string; reason: string | null }[]
}

export interface PrescriptionItem {
  drug: string
  dosage?: string | null
  duration?: string | null
  notes?: string | null
}

export interface Prescription {
  id: string
  patientId: string
  date: string
  items: PrescriptionItem[]
  notes: string | null
  practitioner: TeamMember
}

export type DocumentType = 'CERTIFICATE' | 'SICK_LEAVE' | 'REFERRAL' | 'EXAM_REQUEST' | 'OTHER'

export interface MedicalDocument {
  id: string
  patientId: string
  practitionerId: string
  type: DocumentType
  title: string
  body: string
  createdAt: string
  practitioner?: TeamMember
}

export interface Attachment {
  id: string
  type: 'XRAY' | 'LAB' | 'REPORT' | 'PHOTO' | 'OTHER'
  title: string | null
  fileName: string
  mimeType: string
  size: number
  teeth: string | null
  createdAt: string
}

export interface TimelineEvent {
  kind: 'APPOINTMENT' | 'CONSULTATION' | 'ACT' | 'PRESCRIPTION' | 'DOCUMENT' | 'ATTACHMENT' | 'INVOICE' | 'PAYMENT'
  id: string
  date: string
  title: string
  status?: string
  by?: string | null
  detail?: string | null
  amount?: number
}

// ─── Billing ───

export type ActScope = 'NONE' | 'TOOTH' | 'TEETH' | 'QUADRANT' | 'MOUTH'

export interface Act {
  id: string
  code: string
  name: string
  price: number | string
  specialty: string
  category: string
  scope: ActScope
  usesFaces: boolean
  resultingState: ToothStateCode | null
  isActive: boolean
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK'

export interface Payment {
  id: string
  patientId: string
  invoiceId: string | null
  quoteId: string | null
  method: PaymentMethod
  amount: number | string
  reference: string | null
  paidAt: string
  patient?: { id: string; firstName: string; lastName: string }
  invoice?: { number: string } | null
  quote?: { number: string } | null
}

export interface LineItem {
  id: string
  code: string | null
  label: string
  teeth: string | null
  faces: string | null
  quantity: number
  unitPrice: number | string
  total: number | string
}

export interface PatientRef {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  cin: string | null
  coverage: Coverage
  coverageNumber: string | null
  insuredName?: string | null
  complementaryInsurance?: string | null
  complementaryNumber?: string | null
  address: string | null
}

export interface Invoice {
  id: string
  number: string
  date: string
  total: number | string
  paid: number | string
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED'
  notes: string | null
  patient: PatientRef
  items?: LineItem[]
  payments?: Payment[]
}

export interface Installment {
  dueDate: string
  amount: number
  paid?: number
  status?: 'PAID' | 'LATE' | 'DUE'
}

export interface Quote {
  id: string
  number: string
  date: string
  validUntil: string | null
  total: number | string
  paid: number
  remaining: number
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED'
  acceptedAt: string | null
  notes: string | null
  patient: PatientRef
  items?: LineItem[]
  payments?: Payment[]
  installments?: Installment[]
  treatmentPlan?: { id: string; title: string; status: string } | null
}

// ─── Dental ───

export type ToothStateCode = 'HEALTHY' | 'CARIES' | 'FILLED' | 'CROWN' | 'BRIDGE' | 'ENDO' | 'IMPLANT' | 'MISSING' | 'FRACTURED' | 'MOBILE' | 'ERUPTING'
export type Face = 'M' | 'D' | 'O' | 'I' | 'V' | 'L' | 'P'

export interface ToothState {
  tooth: number
  state: ToothStateCode
  faces: string | null
  notes: string | null
}

export interface DentalChart {
  dentition: Dentition
  autoDentition: Dentition
  forced: boolean
  teeth: number[]
  states: ToothState[]
  plannedTeeth: number[]
}

export interface DentalAct {
  id: string
  actId: string | null
  code: string | null
  label: string
  scope: ActScope
  teeth: string | null
  faces: string | null
  price: number | string
  status: 'PLANNED' | 'DONE' | 'CANCELLED'
  session: number | null
  performedAt: string | null
  notes: string | null
  treatmentPlanId: string | null
  createdAt: string
  practitioner?: TeamMember
}

export interface ToothSheet {
  tooth: number
  state: ToothState
  history: DentalAct[]
  planned: DentalAct[]
  attachments: Attachment[]
}

export interface TreatmentPlan {
  id: string
  title: string
  status: 'PROPOSED' | 'ACCEPTED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  notes: string | null
  createdAt: string
  acts: DentalAct[]
  quote: { id: string; number: string; status: Quote['status']; total: number | string } | null
  total: number
  done: number
  practitioner: TeamMember
}

export interface CabinetDashboard {
  todayAppointments: number
  seenToday: number
  revenueToday: number
  revenueMonth: number
  unpaid: { amount: number; invoices: number }
  noShowRate: number
  newPatients: number
  topActs: { label: string; count: number; total: number }[]
  dental: { plansInProgress: number; quotesOpen: number }
  revenueByMonth: { month: string; total: number }[] | null
}
