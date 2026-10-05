import {
  Activity, Baby, Bandage, CalendarCheck, CircleDot, Droplet, Dumbbell, Eye, FileText, FlaskConical, Footprints, Gauge, Glasses, Hand, HeartPulse,
  LucideIcon, MessageCircle, Microscope, Moon, PersonStanding, Pill, Ruler, ScanEye, ScanLine, Scissors, ShieldCheck, Siren, Smile, Sparkles,
  Stethoscope, Syringe, Thermometer, Wind, Zap,
} from 'lucide-react'

// Online booking: French addresses of the public pages (/rdv/dentiste...) and what each specialty offers.

export type BookingSpecialty = { code: string; slug: string; doctor: string; reasons: string[] }

export const BOOKING_SPECIALTIES: BookingSpecialty[] = [
  { code: 'DENTISTRY', slug: 'dentiste', doctor: 'Dentiste', reasons: ['Contrôle', 'Douleur dentaire', 'Détartrage', 'Soin de carie', 'Urgence', 'Orthodontie'] },
  { code: 'GENERAL', slug: 'medecin-generaliste', doctor: 'Médecin généraliste', reasons: ['Consultation', 'Fièvre / grippe', 'Certificat médical', 'Renouvellement d’ordonnance', 'Résultats d’analyses'] },
  { code: 'PEDIATRICS', slug: 'pediatre', doctor: 'Pédiatre', reasons: ['Consultation', 'Vaccin', 'Suivi de croissance', 'Fièvre', 'Certificat médical'] },
  { code: 'GYNECOLOGY', slug: 'gynecologue', doctor: 'Gynécologue', reasons: ['Consultation', 'Suivi de grossesse', 'Échographie', 'Contraception', 'Frottis'] },
  { code: 'OPHTHALMOLOGY', slug: 'ophtalmologue', doctor: 'Ophtalmologue', reasons: ['Contrôle de la vue', 'Lunettes / lentilles', 'Œil rouge ou douleur', 'Fond d’œil', 'Suivi glaucome'] },
  { code: 'CARDIOLOGY', slug: 'cardiologue', doctor: 'Cardiologue', reasons: ['Consultation', 'Tension artérielle', 'ECG', 'Bilan avant sport', 'Suivi'] },
  { code: 'DERMATOLOGY', slug: 'dermatologue', doctor: 'Dermatologue', reasons: ['Consultation', 'Acné', 'Grain de beauté', 'Eczéma / allergie', 'Cheveux / ongles'] },
  { code: 'PHYSIOTHERAPY', slug: 'kinesitherapeute', doctor: 'Kinésithérapeute', reasons: ['Première séance', 'Rééducation', 'Mal de dos', 'Après une opération', 'Sport'] },
  { code: 'PSYCHIATRY', slug: 'psychiatre', doctor: 'Psychiatre / psychologue', reasons: ['Première consultation', 'Suivi', 'Anxiété / stress', 'Sommeil', 'Enfant / adolescent'] },
]

export const specialtyBySlug = (slug?: string) => BOOKING_SPECIALTIES.find(s => s.slug === slug)
export const specialtyByCode = (code?: string | null) => BOOKING_SPECIALTIES.find(s => s.code === code)

export type BookingHours = Record<string, string[]>
/** slug: the doctor's own booking address inside the cabinet (/rdv/<specialty>/<cabinet>/<slug>) */
export type BookingDoctor = { id: string; title: string | null; firstName: string; lastName: string; specialty: string | null; slug?: string; avatar?: string | null }
export type BookingCabinet = {
  slug: string; name: string; address: string | null; city: string | null; phone: string | null; logo: string | null
  specialty: string; slotMinutes: number; hours: BookingHours; doctors: BookingDoctor[]
}

export const doctorName = (d: BookingDoctor) => `${d.title ? `${d.title} ` : ''}${d.firstName} ${d.lastName}`

/** Languages a doctor can show on their public page (codes stored on the account). */
export const LANGUAGE_NAMES: Record<string, string> = { ar: 'العربية', fr: 'Français', en: 'English', es: 'Español', amz: 'ⵜⴰⵎⴰⵣⵉⵖⵜ Tamazight' }

/** Picture of each visit reason on the booking page (French text = key). */
export const REASON_ICONS: Record<string, LucideIcon> = {
  'Contrôle': Smile, 'Douleur dentaire': Zap, 'Détartrage': Sparkles, 'Soin de carie': Stethoscope, 'Urgence': Siren, 'Orthodontie': Smile,
  'Consultation': Stethoscope, 'Fièvre / grippe': Thermometer, 'Certificat médical': FileText, 'Renouvellement d’ordonnance': Pill, 'Résultats d’analyses': FlaskConical,
  'Vaccin': Syringe, 'Suivi de croissance': Ruler, 'Fièvre': Thermometer,
  'Suivi de grossesse': Baby, 'Échographie': ScanLine, 'Contraception': Pill, 'Frottis': Microscope,
  'Contrôle de la vue': Eye, 'Lunettes / lentilles': Glasses, 'Œil rouge ou douleur': Droplet, 'Fond d’œil': ScanEye, 'Suivi glaucome': ShieldCheck,
  'Tension artérielle': Gauge, 'ECG': Activity, 'Bilan avant sport': Dumbbell, 'Suivi': HeartPulse,
  'Acné': Sparkles, 'Grain de beauté': CircleDot, 'Eczéma / allergie': Hand, 'Cheveux / ongles': Scissors,
  'Première séance': Footprints, 'Rééducation': Activity, 'Mal de dos': PersonStanding, 'Après une opération': Bandage, 'Sport': Dumbbell,
  'Première consultation': MessageCircle, 'Anxiété / stress': Wind, 'Sommeil': Moon, 'Enfant / adolescent': Baby,
}
export const reasonIcon = (reason: string): LucideIcon => REASON_ICONS[reason] || CalendarCheck
