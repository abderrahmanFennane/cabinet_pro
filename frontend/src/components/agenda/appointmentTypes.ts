/** Appointment types with their usual length and the colour shown in the agenda (dot and legend). */
export const APPOINTMENT_TYPES = [
  { value: 'CONSULTATION', label: 'Consultation', minutes: 30, color: '#2D5DAA' },
  { value: 'CONTROL', label: 'Contrôle', minutes: 20, color: '#12705A' },
  { value: 'CARE', label: 'Soins', minutes: 45, color: '#B87700' },
  { value: 'SURGERY', label: 'Chirurgie', minutes: 60, color: '#6746A8' },
  { value: 'EMERGENCY', label: 'Urgence', minutes: 20, color: '#C2410C' },
]

export const typeColor = (type: string) => APPOINTMENT_TYPES.find(t => t.value === type)?.color || '#8A9A94'

export type Absence = { id: string; practitionerId: string | null; startsAt: string; endsAt: string; reason: string | null }

/** Fixed-date public holidays in Morocco (religious holidays follow the lunar calendar and are added by hand). */
export const MOROCCO_HOLIDAYS: [string, string][] = [
  ['01-01', 'Nouvel an'], ['01-11', 'Manifeste de l’indépendance'], ['01-14', 'Nouvel an amazigh'], ['05-01', 'Fête du travail'],
  ['07-30', 'Fête du Trône'], ['08-14', 'Oued Eddahab'], ['08-20', 'Révolution du roi et du peuple'], ['08-21', 'Fête de la jeunesse'],
  ['10-31', 'Fête de l’unité'], ['11-06', 'Marche verte'], ['11-18', 'Fête de l’indépendance'],
]
