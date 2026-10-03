// Default act catalogues copied into each new cabinet of the specialty.
// Indicative prices in MAD; the nomenclature is still to be confirmed with the ANAM (spec section 14).

export type SeedAct = { code: string; name: string; price: number; category: string; scope: string; usesFaces?: boolean; resultingState?: string };

export const DENTAL_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation et bilan bucco-dentaire', price: 200, category: 'Diagnostic', scope: 'NONE' },
  { code: 'RADR', name: 'Radio rétro-alvéolaire', price: 100, category: 'Diagnostic', scope: 'TOOTH' },
  { code: 'PANO', name: 'Radio panoramique', price: 300, category: 'Diagnostic', scope: 'MOUTH' },
  { code: 'DET', name: 'Détartrage et polissage', price: 400, category: 'Prévention', scope: 'MOUTH' },
  { code: 'SCEL', name: 'Scellement de sillons', price: 200, category: 'Prévention', scope: 'TOOTH' },
  { code: 'OBT1', name: 'Obturation composite 1 face', price: 400, category: 'Soins', scope: 'TOOTH', usesFaces: true, resultingState: 'FILLED' },
  { code: 'OBT2', name: 'Obturation composite 2 faces', price: 500, category: 'Soins', scope: 'TOOTH', usesFaces: true, resultingState: 'FILLED' },
  { code: 'OBT3', name: 'Obturation composite 3 faces (MOD)', price: 600, category: 'Soins', scope: 'TOOTH', usesFaces: true, resultingState: 'FILLED' },
  { code: 'END1', name: 'Traitement canalaire monoradiculée', price: 1200, category: 'Endodontie', scope: 'TOOTH', resultingState: 'ENDO' },
  { code: 'END2', name: 'Traitement canalaire pluriradiculée', price: 2000, category: 'Endodontie', scope: 'TOOTH', resultingState: 'ENDO' },
  { code: 'EXT', name: 'Extraction simple', price: 300, category: 'Chirurgie', scope: 'TOOTH', resultingState: 'MISSING' },
  { code: 'EXTC', name: 'Extraction chirurgicale / dent de sagesse', price: 800, category: 'Chirurgie', scope: 'TOOTH', resultingState: 'MISSING' },
  { code: 'IMP', name: 'Implant (pose)', price: 8000, category: 'Implantologie', scope: 'TOOTH', resultingState: 'IMPLANT' },
  { code: 'CCM', name: 'Couronne céramo-métallique', price: 2500, category: 'Prothèse', scope: 'TOOTH', resultingState: 'CROWN' },
  { code: 'CZR', name: 'Couronne zircone', price: 4000, category: 'Prothèse', scope: 'TOOTH', resultingState: 'CROWN' },
  { code: 'BRG3', name: 'Bridge 3 éléments', price: 7500, category: 'Prothèse', scope: 'TEETH', resultingState: 'BRIDGE' },
  { code: 'PAP', name: 'Prothèse amovible partielle', price: 3500, category: 'Prothèse', scope: 'TEETH' },
  { code: 'BLAN', name: 'Blanchiment', price: 2500, category: 'Esthétique', scope: 'MOUTH' },
  { code: 'ORTC', name: 'Consultation orthodontique', price: 300, category: 'Orthodontie', scope: 'NONE' },
];

export const PEDIATRICS_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation pédiatrique', price: 250, category: 'Consultation', scope: 'NONE' },
  { code: 'CTRL', name: 'Consultation de contrôle', price: 150, category: 'Consultation', scope: 'NONE' },
  { code: 'NNE', name: 'Examen du nouveau-né', price: 300, category: 'Suivi', scope: 'NONE' },
  { code: 'VACC', name: 'Vaccination (acte)', price: 100, category: 'Prévention', scope: 'NONE' },
  { code: 'CERT', name: 'Certificat médical (crèche, école, sport)', price: 100, category: 'Documents', scope: 'NONE' },
  { code: 'AERO', name: 'Aérosol', price: 80, category: 'Soins', scope: 'NONE' },
];

export const GYNECOLOGY_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation gynécologique', price: 300, category: 'Consultation', scope: 'NONE' },
  { code: 'CPN', name: 'Consultation prénatale', price: 300, category: 'Grossesse', scope: 'NONE' },
  { code: 'ECHOP', name: 'Échographie pelvienne', price: 400, category: 'Échographie', scope: 'NONE' },
  { code: 'ECHOO', name: 'Échographie obstétricale', price: 500, category: 'Grossesse', scope: 'NONE' },
  { code: 'FCV', name: 'Frottis cervico-vaginal', price: 250, category: 'Dépistage', scope: 'NONE' },
  { code: 'DIU', name: 'Pose de stérilet (DIU)', price: 600, category: 'Contraception', scope: 'NONE' },
  { code: 'COLPO', name: 'Colposcopie', price: 500, category: 'Examens', scope: 'NONE' },
];

export const OPHTHALMOLOGY_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation ophtalmologique', price: 300, category: 'Consultation', scope: 'NONE' },
  { code: 'REFR', name: 'Examen de réfraction', price: 150, category: 'Examens', scope: 'NONE' },
  { code: 'FO', name: 'Fond d’œil', price: 200, category: 'Examens', scope: 'NONE' },
  { code: 'TONO', name: 'Tonométrie (pression oculaire)', price: 100, category: 'Examens', scope: 'NONE' },
  { code: 'CV', name: 'Champ visuel', price: 300, category: 'Examens', scope: 'NONE' },
  { code: 'OCT', name: 'OCT', price: 500, category: 'Imagerie', scope: 'NONE' },
  { code: 'LASER', name: 'Laser (séance)', price: 1500, category: 'Traitements', scope: 'NONE' },
];

export const CARDIOLOGY_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation cardiologique', price: 350, category: 'Consultation', scope: 'NONE' },
  { code: 'ECG', name: 'Électrocardiogramme (ECG)', price: 200, category: 'Examens', scope: 'NONE' },
  { code: 'ETT', name: 'Échocardiographie (ETT)', price: 800, category: 'Imagerie', scope: 'NONE' },
  { code: 'EE', name: 'Épreuve d’effort', price: 1000, category: 'Examens', scope: 'NONE' },
  { code: 'HOLT', name: 'Holter ECG 24 h', price: 800, category: 'Examens', scope: 'NONE' },
  { code: 'MAPA', name: 'Holter tensionnel (MAPA)', price: 700, category: 'Examens', scope: 'NONE' },
];

export const DERMATOLOGY_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation dermatologique', price: 300, category: 'Consultation', scope: 'NONE' },
  { code: 'DERMO', name: 'Dermoscopie', price: 200, category: 'Examens', scope: 'NONE' },
  { code: 'BIOP', name: 'Biopsie cutanée', price: 500, category: 'Actes', scope: 'NONE' },
  { code: 'CRYO', name: 'Cryothérapie (séance)', price: 300, category: 'Traitements', scope: 'NONE' },
  { code: 'PEEL', name: 'Peeling', price: 800, category: 'Esthétique', scope: 'NONE' },
  { code: 'LASER', name: 'Laser (séance)', price: 1000, category: 'Esthétique', scope: 'NONE' },
];

export const PHYSIOTHERAPY_ACTS: SeedAct[] = [
  { code: 'BILAN', name: 'Bilan kinésithérapique initial', price: 250, category: 'Bilan', scope: 'NONE' },
  { code: 'SEANCE', name: 'Séance de rééducation', price: 150, category: 'Séances', scope: 'NONE' },
  { code: 'DRAIN', name: 'Drainage lymphatique', price: 200, category: 'Séances', scope: 'NONE' },
  { code: 'RESP', name: 'Kinésithérapie respiratoire', price: 150, category: 'Séances', scope: 'NONE' },
  { code: 'DOM', name: 'Séance à domicile', price: 250, category: 'Séances', scope: 'NONE' },
];

export const PSYCHIATRY_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Première consultation', price: 400, category: 'Consultation', scope: 'NONE' },
  { code: 'SUIVI', name: 'Consultation de suivi', price: 300, category: 'Consultation', scope: 'NONE' },
  { code: 'PSYTH', name: 'Séance de psychothérapie', price: 350, category: 'Séances', scope: 'NONE' },
  { code: 'TEST', name: 'Bilan psychométrique', price: 600, category: 'Bilans', scope: 'NONE' },
];

export const GENERAL_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation', price: 250, category: 'Consultation', scope: 'NONE' },
  { code: 'CTRL', name: 'Consultation de contrôle', price: 150, category: 'Consultation', scope: 'NONE' },
  { code: 'ECG', name: 'Électrocardiogramme', price: 200, category: 'Examens', scope: 'NONE' },
  { code: 'GLY', name: 'Glycémie capillaire', price: 50, category: 'Examens', scope: 'NONE' },
  { code: 'PANS', name: 'Pansement', price: 100, category: 'Soins', scope: 'NONE' },
  { code: 'INJ', name: 'Injection', price: 80, category: 'Soins', scope: 'NONE' },
];

/** Default act catalogue of every specialty, copied into a new cabinet of that specialty. */
export const ACTS_BY_SPECIALTY: Record<string, SeedAct[]> = {
  DENTISTRY: DENTAL_ACTS,
  GENERAL: GENERAL_ACTS,
  PEDIATRICS: PEDIATRICS_ACTS,
  GYNECOLOGY: GYNECOLOGY_ACTS,
  OPHTHALMOLOGY: OPHTHALMOLOGY_ACTS,
  CARDIOLOGY: CARDIOLOGY_ACTS,
  DERMATOLOGY: DERMATOLOGY_ACTS,
  PHYSIOTHERAPY: PHYSIOTHERAPY_ACTS,
  PSYCHIATRY: PSYCHIATRY_ACTS,
};
