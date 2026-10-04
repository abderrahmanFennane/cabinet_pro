import ExcelJS from 'exceljs';

/**
 * Patient list import (Excel or CSV) for a clinic moving from paper or another software.
 * Columns are recognised by name (French or English, accents and case ignored), in any order.
 */
export type ImportedPatient = {
  firstName: string;
  lastName: string;
  sex?: 'F' | 'M' | null;
  birthDate?: Date | null;
  cin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  coverage?: string;
  coverageNumber?: string | null;
  complementaryInsurance?: string | null;
  notes?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  currentTreatments?: string | null;
  bloodGroup?: string | null;
};

export type ImportLine = { line: number; patient?: ImportedPatient; errors: string[]; warnings: string[] };

// Strips accents: the class below is the combining marks range U+0300 to U+036F.
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Field <- accepted header names (normalised).
const COLUMNS: Record<keyof ImportedPatient | 'fullName', string[]> = {
  lastName: ['nom', 'nom de famille', 'last name', 'lastname', 'surname', 'family name'],
  firstName: ['prenom', 'first name', 'firstname', 'given name'],
  fullName: ['nom complet', 'nom et prenom', 'nom prenom', 'patient', 'full name', 'name'],
  sex: ['sexe', 'genre', 'sex', 'gender'],
  birthDate: ['date de naissance', 'naissance', 'date naissance', 'ne le', 'nee le', 'ddn', 'birth date', 'birthdate', 'date of birth', 'dob'],
  cin: ['cin', 'cnie', 'carte nationale', 'n cin', 'numero cin', 'id', 'national id'],
  phone: ['telephone', 'tel', 'gsm', 'portable', 'mobile', 'phone', 'numero de telephone', 'n telephone'],
  email: ['email', 'e mail', 'mail', 'courriel'],
  address: ['adresse', 'address', 'ville', 'city'],
  coverage: ['couverture', 'assurance', 'mutuelle', 'organisme', 'amo', 'insurance', 'coverage'],
  coverageNumber: ['n immatriculation', 'immatriculation', 'numero immatriculation', 'n affiliation', 'affiliation', 'matricule', 'n assure', 'insurance number'],
  complementaryInsurance: ['complementaire', 'assurance complementaire', 'mutuelle complementaire'],
  notes: ['notes', 'remarques', 'observations', 'commentaire', 'comments'],
  allergies: ['allergies', 'allergie', 'allergy'],
  medicalHistory: ['antecedents', 'antecedents medicaux', 'medical history', 'history'],
  currentTreatments: ['traitements', 'traitement en cours', 'traitements en cours', 'medications', 'current treatments'],
  bloodGroup: ['groupe sanguin', 'groupe', 'blood group', 'blood type'],
};
export const MEDICAL_COLUMNS: (keyof ImportedPatient)[] = ['allergies', 'medicalHistory', 'currentTreatments', 'bloodGroup'];

/** Header row of the template file offered for download. */
export const TEMPLATE_HEADERS = ['Nom', 'Prénom', 'Sexe (F/M)', 'Date de naissance (JJ/MM/AAAA)', 'CIN', 'Téléphone', 'Email', 'Adresse', 'Couverture (CNSS, CNOPS, AMO Tadamon, FAR, Mutuelle, Privée, Aucune)', 'N° immatriculation', 'Complémentaire', 'Allergies', 'Antécédents', 'Traitements en cours', 'Groupe sanguin', 'Notes'];
export const TEMPLATE_EXAMPLE = ['ALAOUI', 'Salma', 'F', '14/02/1988', 'BK123456', '0612345678', 'salma@example.ma', 'Casablanca', 'CNSS', '123456789', 'AXA', 'Pénicilline', 'Asthme', '', 'O+', ''];

function fieldFor(header: string): keyof typeof COLUMNS | null {
  const h = norm(header);
  if (!h) return null;
  for (const [field, names] of Object.entries(COLUMNS)) if (names.includes(h)) return field as keyof typeof COLUMNS;
  // "Couverture (CNSS, CNOPS, ...)" and other headers with a hint after the name
  for (const [field, names] of Object.entries(COLUMNS)) if (names.some(n => n.length > 3 && h.startsWith(n + ' '))) return field as keyof typeof COLUMNS;
  return null;
}

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as any;
    if ('result' in o) return cellText(o.result);
    if ('text' in o) return cellText(o.text);
    if (Array.isArray(o.richText)) return o.richText.map((r: any) => r.text).join('');
    if ('hyperlink' in o) return String(o.text ?? o.hyperlink);
  }
  return String(v).replace(/\s+/g, ' ').trim();
};

function parseDate(v: unknown): Date | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? 'invalid' : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); // Excel serial date
  const s = cellText(v);
  let m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += year > new Date().getFullYear() % 100 ? 1900 : 2000;
    const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1])));
    return d.getUTCDate() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 ? d : 'invalid';
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return 'invalid';
}

function parseSex(v: string): 'F' | 'M' | null | 'invalid' {
  const s = norm(v);
  if (!s) return null;
  if (['f', 'femme', 'feminin', 'female', 'w'].includes(s)) return 'F';
  if (['m', 'h', 'homme', 'masculin', 'male'].includes(s)) return 'M';
  return 'invalid';
}

function parseCoverage(v: string): { coverage: string; rest?: string } | null {
  const s = norm(v);
  if (!s) return null;
  if (/cnss|amo cnss/.test(s)) return { coverage: 'CNSS' };
  if (/cnops|public|fonctionnaire/.test(s)) return { coverage: 'CNOPS' };
  if (/tadamon|ramed/.test(s)) return { coverage: 'AMO_TADAMON' };
  if (/\bfar\b|forces armees|militaire/.test(s)) return { coverage: 'FAR' };
  if (/^(aucune?|non|sans|none|neant)$/.test(s)) return { coverage: 'NONE' };
  if (/mutuelle|mgpap|omfam|mgen|modep/.test(s)) return { coverage: 'MUTUELLE', rest: cellText(v) };
  // A private insurer's name (AXA, Wafa, Saham, RMA...)
  return { coverage: 'PRIVATE', rest: cellText(v) };
}

const phoneOf = (v: string) => {
  const digits = v.replace(/[^\d+]/g, '');
  if (!digits) return null;
  // Excel drops the leading 0 of "0612345678"
  if (/^[5-7]\d{8}$/.test(digits)) return `0${digits}`;
  return digits;
};

async function readRows(buffer: Buffer, fileName: string): Promise<unknown[][]> {
  if (/\.csv$/i.test(fileName) || !buffer.subarray(0, 2).equals(Buffer.from('PK'))) {
    let content = buffer.toString('utf8');
    // U+FFFD = undecodable byte, U+FEFF = byte order mark
    if (content.includes('�')) content = buffer.toString('latin1'); // CSV saved by Excel in Windows-1252
    content = content.replace(/^﻿/, '');
    // Separator: the most frequent of ; , tab over the first lines (a title line may have none).
    const head = content.split(/\r?\n/, 6).join('\n');
    const count = (c: string) => head.split(c).length - 1;
    const sep = [';', '\t', ','].reduce((best, c) => (count(c) > count(best) ? c : best), ';');
    const rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false;
    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      if (quoted) {
        if (c === '"' && content[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && content[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets.find(w => w.rowCount > 0);
  if (!ws) return [];
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (r) => { rows.push((r.values as unknown[]).slice(1)); });
  return rows;
}

export const MAX_IMPORT_ROWS = 5000;

/** Reads the file and checks every line. Duplicates against the clinic are checked by the route. */
export async function parsePatientFile(buffer: Buffer, fileName: string): Promise<{ lines: ImportLine[]; columns: string[]; ignored: string[] }> {
  const rows = await readRows(buffer, fileName);
  // The header is the first line that names at least one known column (files often start with a title).
  const headerIndex = rows.findIndex(r => r.filter(c => fieldFor(cellText(c))).length >= 2);
  if (headerIndex < 0) throw new Error('Aucune colonne reconnue : la première ligne doit contenir les titres (Nom, Prénom, Téléphone…). Téléchargez le modèle.');
  const header = rows[headerIndex].map(c => cellText(c));
  const fields = header.map(fieldFor);
  if (!fields.includes('lastName') && !fields.includes('fullName')) throw new Error('Colonne « Nom » introuvable.');

  const lines: ImportLine[] = [];
  const body = rows.slice(headerIndex + 1);
  if (body.length > MAX_IMPORT_ROWS) throw new Error(`Fichier trop long : ${MAX_IMPORT_ROWS} patients maximum par import.`);
  body.forEach((raw, i) => {
    const line = headerIndex + i + 2;
    const get = (f: keyof typeof COLUMNS) => { const idx = fields.indexOf(f); return idx < 0 ? undefined : raw[idx]; };
    const txt = (f: keyof typeof COLUMNS) => cellText(get(f)) || null;
    if (!raw.some(c => cellText(c))) return; // empty line
    const errors: string[] = [], warnings: string[] = [];

    let lastName = txt('lastName') || '';
    let firstName = txt('firstName') || '';
    if ((!lastName || !firstName) && txt('fullName')) {
      const parts = txt('fullName')!.split(' ');
      if (!lastName) lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
      if (!firstName) firstName = parts.length > 1 ? parts[0] : '';
    }
    if (!lastName) errors.push('Nom manquant');
    if (!firstName) errors.push('Prénom manquant');

    const patient: ImportedPatient = { firstName: firstName.slice(0, 100), lastName: lastName.slice(0, 100) };
    const sex = parseSex(txt('sex') || '');
    if (sex === 'invalid') warnings.push(`Sexe « ${txt('sex')} » ignoré`); else patient.sex = sex;
    const birth = parseDate(get('birthDate'));
    if (birth === 'invalid') warnings.push(`Date de naissance « ${txt('birthDate')} » ignorée`);
    else if (birth && (birth > new Date() || birth.getUTCFullYear() < 1900)) warnings.push('Date de naissance improbable ignorée');
    else patient.birthDate = birth;
    patient.cin = txt('cin')?.toUpperCase().replace(/\s/g, '').slice(0, 20) ?? null;
    patient.phone = phoneOf(txt('phone') || '')?.slice(0, 30) ?? null;
    const email = txt('email');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) warnings.push(`Email « ${email} » ignoré`); else patient.email = email;
    patient.address = txt('address')?.slice(0, 255) ?? null;
    const cov = parseCoverage(txt('coverage') || '');
    if (cov) {
      patient.coverage = cov.coverage;
      if (cov.rest && !txt('complementaryInsurance')) patient.complementaryInsurance = cov.rest.slice(0, 80);
    }
    patient.coverageNumber = txt('coverageNumber')?.slice(0, 50) ?? null;
    if (txt('complementaryInsurance')) patient.complementaryInsurance = txt('complementaryInsurance')!.slice(0, 80);
    patient.notes = txt('notes');
    patient.allergies = txt('allergies');
    patient.medicalHistory = txt('medicalHistory');
    patient.currentTreatments = txt('currentTreatments');
    patient.bloodGroup = txt('bloodGroup')?.toUpperCase().replace(/\s/g, '').slice(0, 5) ?? null;
    if (!patient.phone && !patient.cin && !patient.birthDate) warnings.push('Ni téléphone, ni CIN, ni date de naissance : difficile à retrouver');
    lines.push({ line, patient: errors.length ? undefined : patient, errors, warnings });
  });
  return {
    lines,
    columns: header.filter((_, i) => fields[i]),
    ignored: header.filter((h, i) => h && !fields[i]),
  };
}
