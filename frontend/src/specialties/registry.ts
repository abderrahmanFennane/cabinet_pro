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
    features: ['Courbes OMS de poids, taille, PC et IMC, âge corrigé des prématurés, alerte de cassure', 'Calendrier vaccinal PNI : faits, à faire, en retard, n° de lot', 'Développement psychomoteur et dépistages (audition, vision, M-CHAT-R)', 'Doses selon le poids et ordonnance en un clic', 'Certificats : crèche, école, sport, vaccination, non-contagion'],
  },
  GYNECOLOGY: {
    code: 'GYNECOLOGY', tab: 'Grossesse et suivi', component: lazy(() => import('./Gynecology')),
    features: ['Grossesse : SA, terme, groupe et Rhésus, jumeaux, accouchement', 'Calendrier prénatal : examens faits, à faire, en retard', 'Échographies : biométrie, poids fœtal estimé (Hadlock) et percentile, datation par la LCC', 'Antécédents obstétricaux : gestité et parité calculées', 'Suivi gynécologique : contraception, frottis, test HPV, mammographie'],
  },
  OPHTHALMOLOGY: {
    code: 'OPHTHALMOLOGY', tab: 'Yeux', component: lazy(() => import('./Ophthalmology')),
    features: ['Examen OD / OG : acuité, réfraction, tonus, pachymétrie', 'Glaucome : pression cible, champ visuel (MD, PSD, VFI), OCT RNFL et courbes', 'OCT, rétinographies et angiographies jointes, comparées dans le temps', 'Ordonnances de lunettes (prisme, EP) et de lentilles de contact', 'Biométrie, calcul d’implant SRK/T et compte rendu opératoire'],
  },
  CARDIOLOGY: {
    code: 'CARDIOLOGY', tab: 'Cœur', component: lazy(() => import('./Cardiology')),
    features: ['Plan de suivi : anticoagulation, cibles INR et tension, prochain contrôle', 'Scores CHA₂DS₂-VASc et HAS-BLED', 'ECG, échocardiographie, Holter, MAPA et épreuve d’effort avec tracés joints', 'Biologie : DFG (CKD-EPI) et cible LDL selon le risque'],
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
