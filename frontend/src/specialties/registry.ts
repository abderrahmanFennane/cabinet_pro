import { ComponentType, lazy } from 'react'
import { Patient, Specialty } from '../types'

export type SpecialtyModule = {
  code: Specialty
  /** Tab of the patient record. */
  tab: string
  /** What the module gives the doctor, shown to the Super Admin. */
  features: string[]
  /** Screen of the module; the dentist keeps its own tab (tooth chart) in the patient record. */
  component?: ComponentType<{ patient: Patient }>
}

// Each specialty is one module: adding a specialty never touches the shared patient, agenda or billing screens.
export const SPECIALTY_MODULES: Record<Specialty, SpecialtyModule> = {
  DENTISTRY: {
    code: 'DENTISTRY', tab: 'Dents',
    features: ['Schéma dentaire dessiné (FDI), selon l’âge', 'États et faces de chaque dent', 'Plans de traitement, devis, échéanciers'],
  },
  GENERAL: {
    code: 'GENERAL', tab: 'Constantes', component: lazy(() => import('./General')),
    features: ['Tension, pouls, poids, température, SpO2', 'Courbes de tension, poids, glycémie, HbA1c', 'Suivi des maladies chroniques'],
  },
  PEDIATRICS: {
    code: 'PEDIATRICS', tab: 'Croissance et vaccins', component: lazy(() => import('./Pediatrics')),
    features: ['Courbes de poids, taille, périmètre crânien et IMC par âge', 'Calendrier vaccinal PNI : faits, à faire, en retard', 'N° de lot des vaccins'],
  },
  GYNECOLOGY: {
    code: 'GYNECOLOGY', tab: 'Grossesse et suivi', component: lazy(() => import('./Gynecology')),
    features: ['Grossesse : SA, trimestre et terme depuis la DDR', 'Consultations, échographies, bilans, prise de poids', 'Contraception, frottis (alerte après 3 ans)'],
  },
  OPHTHALMOLOGY: {
    code: 'OPHTHALMOLOGY', tab: 'Yeux', component: lazy(() => import('./Ophthalmology')),
    features: ['Examen OD / OG : acuité, réfraction, tonus', 'Courbe de pression oculaire (seuil 21 mmHg)', 'Ordonnance de lunettes imprimable'],
  },
  CARDIOLOGY: {
    code: 'CARDIOLOGY', tab: 'Cœur', component: lazy(() => import('./Cardiology')),
    features: ['Facteurs de risque cardiovasculaire', 'Courbes de tension, fréquence et INR (AVK)', 'Comptes rendus d’ECG'],
  },
  DERMATOLOGY: {
    code: 'DERMATOLOGY', tab: 'Peau', component: lazy(() => import('./Dermatology')),
    features: ['Carte du corps (face et dos) pour situer les lésions', 'Suivi de chaque lésion : active, en amélioration, guérie', 'Photos jointes dans Documents'],
  },
  PHYSIOTHERAPY: {
    code: 'PHYSIOTHERAPY', tab: 'Rééducation', component: lazy(() => import('./Physiotherapy')),
    features: ['Programme selon l’ordonnance (séances prescrites)', 'Séances réalisées / prescrites', 'Courbe de douleur (EVA)'],
  },
  PSYCHIATRY: {
    code: 'PSYCHIATRY', tab: 'Suivi psy', component: lazy(() => import('./Psychiatry')),
    features: ['Notes de séance privées (visibles par l’auteur seul)', 'Échelles PHQ-9 et GAD-7 avec interprétation', 'Courbe d’évolution des scores'],
  },
}
