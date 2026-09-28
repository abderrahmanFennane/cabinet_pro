// Mirror of backend/src/types/permissions.ts
export type PermissionKey =
  | 'MANAGE_PATIENTS'
  | 'VIEW_MEDICAL'
  | 'MANAGE_APPOINTMENTS'
  | 'MANAGE_CONSULTATIONS'
  | 'MANAGE_PRESCRIPTIONS'
  | 'PRINT_DOCUMENTS'
  | 'MANAGE_BILLING'
  | 'VIEW_REPORTS'
  | 'ADVANCED_STATS'
  | 'DENTAL_CHART'
  | 'DENTAL_TREATMENT_PLAN'
  | 'MANAGE_TEAM'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_SUBSCRIPTION'
  | 'MULTI_SPECIALTY'
  | 'MANAGE_CABINETS'

export type PermissionDefinition = { key: PermissionKey; module: string; label: string }

export const PERMISSIONS: PermissionDefinition[] = [
  { key: 'MANAGE_PATIENTS', module: 'Patients', label: 'Fiche administrative des patients' },
  { key: 'VIEW_MEDICAL', module: 'Médical', label: 'Contenu médical' },
  { key: 'MANAGE_APPOINTMENTS', module: 'Agenda', label: 'Agenda et salle d’attente' },
  { key: 'MANAGE_CONSULTATIONS', module: 'Médical', label: 'Consultations' },
  { key: 'MANAGE_PRESCRIPTIONS', module: 'Médical', label: 'Ordonnances et certificats' },
  { key: 'PRINT_DOCUMENTS', module: 'Médical', label: 'Impression des documents' },
  { key: 'MANAGE_BILLING', module: 'Facturation', label: 'Encaissements, factures' },
  { key: 'VIEW_REPORTS', module: 'Statistiques', label: 'Tableau de bord' },
  { key: 'ADVANCED_STATS', module: 'Statistiques', label: 'Statistiques avancées' },
  { key: 'DENTAL_CHART', module: 'Dentaire', label: 'Schéma dentaire et actes' },
  { key: 'DENTAL_TREATMENT_PLAN', module: 'Dentaire', label: 'Plans de traitement, devis, échéanciers' },
  { key: 'MANAGE_TEAM', module: 'Cabinet', label: 'Équipe' },
  { key: 'MANAGE_SETTINGS', module: 'Cabinet', label: 'Tarifs et paramètres' },
  { key: 'MANAGE_SUBSCRIPTION', module: 'Cabinet', label: 'Abonnement' },
  { key: 'MULTI_SPECIALTY', module: 'Cabinet', label: 'Plusieurs spécialités' },
]

export const PERMISSION_LABELS = Object.fromEntries(PERMISSIONS.map(p => [p.key, p.label])) as Record<PermissionKey, string>

export const PERMISSIONS_BY_MODULE = PERMISSIONS.reduce((acc, p) => {
  (acc[p.module] ||= []).push(p)
  return acc
}, {} as Record<string, PermissionDefinition[]>)
