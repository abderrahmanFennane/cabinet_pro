import { ZodIssue } from 'zod';

/** French names of the fields of the specialty forms, for error messages a doctor can understand. */
const FIELD: Record<string, string> = {
  od: 'œil droit', os: 'œil gauche', iop: 'tonus (PIO)', cct: 'pachymétrie', sphere: 'sphère', cylinder: 'cylindre', axis: 'axe', add: 'addition',
  prism: 'prisme', pd: 'écart pupillaire', va: 'acuité', vaCorrected: 'acuité corrigée', md: 'MD', psd: 'PSD', vfi: 'VFI',
  k1: 'K1', k2: 'K2', axialLength: 'longueur axiale', acd: 'profondeur de chambre', aConstant: 'constante A', targetRefraction: 'réfraction visée',
  rnflAvg: 'RNFL moyen', rnflSup: 'RNFL supérieur', rnflInf: 'RNFL inférieur', gcc: 'GCC', cmt: 'épaisseur maculaire', targetIopOd: 'pression cible OD', targetIopOs: 'pression cible OG',
  systolic: 'tension systolique', diastolic: 'tension diastolique', heartRate: 'fréquence cardiaque', pulse: 'pouls', inr: 'INR', weight: 'poids', height: 'taille',
  temperature: 'température', glucose: 'glycémie', hba1c: 'HbA1c', spo2: 'SpO2', headCircumference: 'périmètre crânien',
  rate: 'fréquence', pr: 'PR', qrs: 'QRS', qtc: 'QTc', lvef: 'FEVG', ldl: 'LDL', hdl: 'HDL', creatinine: 'créatinine', potassium: 'potassium', sodium: 'sodium',
  fundalHeight: 'hauteur utérine', fetalHeartRate: 'BCF', crl: 'LCC', nuchal: 'clarté nucale', bpd: 'BIP', hc: 'PC', ac: 'PA', fl: 'LF', efw: 'poids fœtal',
  gestationalWeeks: 'terme', birthWeight: 'poids de naissance', pain: 'douleur', score: 'score',
  label: 'libellé', items: 'lignes', date: 'date', email: 'email', phone: 'téléphone', amount: 'montant', price: 'tarif', durationMinutes: 'durée', quantity: 'quantité', unitPrice: 'prix unitaire',
};

const valueAt = (data: unknown, path: (string | number)[]) => path.reduce<any>((v, k) => (v == null ? undefined : v[k]), data);

/** "Valeur impossible pour tonus (PIO) (œil droit) : 540. Maximum 80." from a zod issue. */
export function readableIssue(issue: ZodIssue, data: unknown, fallback: string) {
  const names = issue.path.filter(p => typeof p === 'string').map(p => FIELD[p as string] || String(p))
  // "od.iop" -> "tonus (PIO) (œil droit)": the field first, then the eye or group it belongs to.
  const field = names.length ? [names[names.length - 1], ...names.slice(0, -1).reverse().map(n => `(${n})`)].join(' ') : fallback;
  // Messages written in French in the schemas ("Libellé requis", "Choisissez une facture…") are kept as they are;
  // only zod's default English messages are rewritten.
  const english = /^(Number|String|Array|Date) must|^Required$|^Expected |^Invalid /.test(issue.message);
  if (!english) return issue.path.length ? `${issue.message} (${field})` : issue.message;
  const value = valueAt(data, issue.path);
  const shown = value === undefined || value === null || value === '' ? '' : ` : ${value}`;
  switch (issue.code) {
    case 'too_big': return `Valeur impossible pour ${field}${shown}. Maximum ${issue.maximum}.`;
    case 'too_small': return `Valeur impossible pour ${field}${shown}. Minimum ${issue.minimum}.`;
    case 'invalid_type': return issue.received === 'undefined' ? `Champ obligatoire : ${field}.` : `Valeur non valide pour ${field}${shown}.`;
    case 'invalid_enum_value': return `Choix non valide pour ${field}${shown}.`;
    case 'invalid_string': case 'invalid_date': return `Format non valide pour ${field}${shown}.`;
    default: return `${field} : ${issue.message}`;
  }
}
