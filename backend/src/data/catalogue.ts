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

export const GENERAL_ACTS: SeedAct[] = [
  { code: 'CONS', name: 'Consultation', price: 250, category: 'Consultation', scope: 'NONE' },
  { code: 'CTRL', name: 'Consultation de contrôle', price: 150, category: 'Consultation', scope: 'NONE' },
  { code: 'ECG', name: 'Électrocardiogramme', price: 200, category: 'Examens', scope: 'NONE' },
  { code: 'GLY', name: 'Glycémie capillaire', price: 50, category: 'Examens', scope: 'NONE' },
  { code: 'PANS', name: 'Pansement', price: 100, category: 'Soins', scope: 'NONE' },
  { code: 'INJ', name: 'Injection', price: 80, category: 'Soins', scope: 'NONE' },
];
