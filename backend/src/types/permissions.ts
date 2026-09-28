// A user's effective permissions = permissions of their role ∩ feature keys of the cabinet's plan.
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
  | 'MANAGE_CABINETS';

export type PermissionModule = 'Patients' | 'Agenda' | 'Médical' | 'Facturation' | 'Statistiques' | 'Dentaire' | 'Cabinet' | 'Plateforme';

export type PermissionDefinition = {
  key: PermissionKey;
  module: PermissionModule;
  label: string;
};

export const PERMISSIONS: PermissionDefinition[] = [
  { key: 'MANAGE_PATIENTS', module: 'Patients', label: 'Fiche administrative des patients' },
  { key: 'VIEW_MEDICAL', module: 'Médical', label: 'Contenu médical (antécédents, consultations, schéma dentaire)' },
  { key: 'MANAGE_APPOINTMENTS', module: 'Agenda', label: 'Agenda et salle d’attente' },
  { key: 'MANAGE_CONSULTATIONS', module: 'Médical', label: 'Consultations' },
  { key: 'MANAGE_PRESCRIPTIONS', module: 'Médical', label: 'Créer et signer ordonnances et certificats' },
  { key: 'PRINT_DOCUMENTS', module: 'Médical', label: 'Imprimer ordonnances et documents' },
  { key: 'MANAGE_BILLING', module: 'Facturation', label: 'Encaissements, factures et devis' },
  { key: 'VIEW_REPORTS', module: 'Statistiques', label: 'Tableau de bord' },
  { key: 'ADVANCED_STATS', module: 'Statistiques', label: 'Statistiques avancées' },
  { key: 'DENTAL_CHART', module: 'Dentaire', label: 'Schéma dentaire et actes' },
  { key: 'DENTAL_TREATMENT_PLAN', module: 'Dentaire', label: 'Plans de traitement, devis et échéanciers' },
  { key: 'MANAGE_TEAM', module: 'Cabinet', label: 'Équipe' },
  { key: 'MANAGE_SETTINGS', module: 'Cabinet', label: 'Tarifs et paramètres' },
  { key: 'MANAGE_SUBSCRIPTION', module: 'Cabinet', label: 'Abonnement' },
  { key: 'MULTI_SPECIALTY', module: 'Cabinet', label: 'Plusieurs spécialités dans le cabinet' },
  { key: 'MANAGE_CABINETS', module: 'Plateforme', label: 'Gestion des cabinets (Super Admin)' },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map(p => p.key);

// Rights matrix of the specification (section 03).
export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  OWNER: ALL_PERMISSION_KEYS.filter(key => key !== 'MANAGE_CABINETS'),
  PRACTITIONER: [
    'MANAGE_PATIENTS', 'VIEW_MEDICAL', 'MANAGE_APPOINTMENTS', 'MANAGE_CONSULTATIONS', 'MANAGE_PRESCRIPTIONS',
    'PRINT_DOCUMENTS', 'MANAGE_BILLING', 'VIEW_REPORTS', 'ADVANCED_STATS', 'DENTAL_CHART', 'DENTAL_TREATMENT_PLAN', 'MULTI_SPECIALTY',
  ],
  ASSISTANT: ['MANAGE_PATIENTS', 'MANAGE_APPOINTMENTS', 'PRINT_DOCUMENTS', 'MANAGE_BILLING'],
};

export const ROLES = ['SUPER_ADMIN', 'OWNER', 'PRACTITIONER', 'ASSISTANT'] as const;
export type Role = typeof ROLES[number];

export const SPECIALTIES = ['DENTISTRY', 'GENERAL', 'PEDIATRICS', 'GYNECOLOGY', 'OPHTHALMOLOGY', 'CARDIOLOGY', 'DERMATOLOGY', 'PHYSIOTHERAPY', 'PSYCHIATRY'] as const;
