import { Specialty, Vitals } from '../types'

/**
 * Consultation form per specialty: which vital signs are asked, frequent reasons as one-tap chips,
 * and the usual examination headings (inserted as lines the doctor completes). The saved consultation
 * keeps the same fields for every specialty, so the patient file, PDF and statistics stay common.
 */
export type ConsultationProfile = {
  vitals: (keyof Vitals)[]
  reasons: string[]
  exam: string[]
  examLabel?: string
  planLabel?: string
}

const ALL: (keyof Vitals)[] = ['systolic', 'diastolic', 'pulse', 'temperature', 'weight', 'height', 'glucose', 'spo2']

export const CONSULTATION_PROFILES: Record<Specialty, ConsultationProfile> = {
  GENERAL: {
    vitals: ALL,
    reasons: ['Fièvre', 'Toux', 'Mal de gorge', 'Douleur abdominale', 'Céphalées', 'Renouvellement d’ordonnance', 'Bilan de santé', 'Certificat médical'],
    exam: ['État général', 'Cardio-pulmonaire', 'Abdomen', 'ORL', 'Neurologique', 'Cutané'],
  },
  PEDIATRICS: {
    vitals: ['temperature', 'weight', 'height', 'pulse', 'spo2'],
    reasons: ['Fièvre', 'Toux', 'Diarrhée', 'Vomissements', 'Éruption', 'Visite systématique', 'Vaccination', 'Pleurs, coliques'],
    exam: ['État général', 'Hydratation', 'ORL', 'Pulmonaire', 'Abdomen', 'Peau', 'Développement psychomoteur'],
  },
  GYNECOLOGY: {
    vitals: ['systolic', 'diastolic', 'pulse', 'weight'],
    reasons: ['Suivi de grossesse', 'Contraception', 'Frottis', 'Troubles des règles', 'Douleurs pelviennes', 'Pertes vaginales', 'Infertilité', 'Ménopause'],
    exam: ['Seins', 'Abdomen', 'Examen au spéculum', 'Toucher vaginal', 'Échographie'],
  },
  OPHTHALMOLOGY: {
    vitals: [],
    reasons: ['Baisse de vision', 'Œil rouge', 'Contrôle de lunettes', 'Fond d’œil (diabète)', 'Tension oculaire', 'Corps étranger', 'Larmoiement'],
    exam: ['Acuité visuelle OD / OG', 'Réfraction', 'Lampe à fente', 'Tonus oculaire', 'Fond d’œil'],
    examLabel: 'Examen ophtalmologique',
  },
  CARDIOLOGY: {
    vitals: ['systolic', 'diastolic', 'pulse', 'weight', 'spo2'],
    reasons: ['Douleur thoracique', 'Palpitations', 'Essoufflement', 'Suivi de l’hypertension', 'Malaise', 'Bilan préopératoire', 'Suivi sous anticoagulant'],
    exam: ['Auscultation cardiaque', 'Auscultation pulmonaire', 'Pouls périphériques', 'Œdèmes', 'ECG', 'Échocardiographie'],
    examLabel: 'Examen cardiovasculaire',
  },
  DERMATOLOGY: {
    vitals: [],
    reasons: ['Acné', 'Eczéma', 'Grain de beauté', 'Chute de cheveux', 'Mycose', 'Psoriasis', 'Démangeaisons', 'Taches'],
    exam: ['Lésion élémentaire', 'Topographie', 'Taille et couleur', 'Dermoscopie', 'Phanères', 'Muqueuses'],
    examLabel: 'Examen dermatologique',
  },
  PHYSIOTHERAPY: {
    vitals: [],
    reasons: ['Lombalgie', 'Cervicalgie', 'Rééducation après chirurgie', 'Entorse', 'Épaule douloureuse', 'Genou', 'Rééducation neurologique'],
    exam: ['Douleur (EVA)', 'Amplitudes articulaires', 'Testing musculaire', 'Équilibre et marche', 'Bilan fonctionnel'],
    examLabel: 'Bilan kinésithérapique',
    planLabel: 'Programme de séances',
  },
  PSYCHIATRY: {
    vitals: ['weight'],
    reasons: ['Anxiété', 'Humeur triste', 'Troubles du sommeil', 'Suivi du traitement', 'Crise', 'Addiction'],
    exam: ['Présentation', 'Humeur', 'Idées suicidaires', 'Sommeil', 'Appétit', 'Insight et observance'],
    examLabel: 'Entretien et examen psychique',
  },
  DENTISTRY: {
    vitals: ['systolic', 'diastolic'],
    reasons: ['Douleur dentaire', 'Contrôle', 'Détartrage', 'Saignement des gencives', 'Prothèse', 'Urgence', 'Esthétique'],
    exam: ['Examen exobuccal', 'Examen endobuccal', 'Parodonte', 'Occlusion', 'Radiographie'],
    examLabel: 'Examen bucco-dentaire',
  },
}

export const profileFor = (specialty?: Specialty | string | null) =>
  CONSULTATION_PROFILES[(specialty as Specialty) || 'GENERAL'] || CONSULTATION_PROFILES.GENERAL
