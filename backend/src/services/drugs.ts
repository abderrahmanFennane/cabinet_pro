import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

/** One medicine of the national list, as stored in prisma/data/drugs-ma.json and in the Drug table. */
export interface DrugRow {
  code: string;
  name: string;
  dci?: string | null;
  dosage?: string | null;
  form?: string | null;
  presentation?: string | null;
  ppv?: number | null;
  refundRate?: number | null;
  generic?: boolean;
}

const DATA_FILE = path.join(__dirname, '..', '..', '..', 'prisma', 'data', 'drugs-ma.json');
const dataFile = () => [DATA_FILE, path.join(process.cwd(), 'prisma', 'data', 'drugs-ma.json')].find(f => fs.existsSync(f));

const text = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = String(typeof v === 'object' && v && 'result' in (v as any) ? (v as any).result : v).replace(/\s+/g, ' ').trim();
  return s || null;
};
const num = (v: unknown) => {
  const s = text(v);
  if (!s) return null;
  const n = Number(s.replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
// "DOLIPRANE 1000 MG" stays as it is; the strength is added when the name does not carry it.
const fullName = (name: string, dosage: string | null) =>
  dosage && !/\d/.test(name) ? `${name} ${dosage}` : name;

/**
 * Reads a medicine list in the format of the CNOPS / DMP reference file:
 * columns CODE, NOM, DCI1, DOSAGE1, UNITE_DOSAGE1, FORME, PRESENTATION, PPV, PRINCEPS_GENERIQUE, TAUX_REMBOURSEMENT
 * (any order, first row = headers). Rows without code or name are skipped; a code seen twice keeps the first row.
 */
export async function parseDrugWorkbook(buffer: Buffer | ArrayBuffer): Promise<DrugRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Fichier vide');
  const headers = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => { const h = text(cell.value); if (h) headers.set(h.toUpperCase(), col); });
  const col = (row: ExcelJS.Row, ...names: string[]) => {
    for (const n of names) { const c = headers.get(n); if (c) return row.getCell(c).value; }
    return null;
  };
  if (!headers.has('CODE') || !headers.has('NOM')) throw new Error('Colonnes CODE et NOM introuvables sur la première ligne');

  const rows: DrugRow[] = [];
  const seen = new Set<string>();
  ws.eachRow((row, index) => {
    if (index === 1) return;
    const code = text(col(row, 'CODE'));
    const name = text(col(row, 'NOM'));
    if (!code || !name || seen.has(code)) return;
    seen.add(code);
    const amount = text(col(row, 'DOSAGE1', 'DOSAGE'));
    // Combinations repeat the unit ("MG / MG / MG"): one is enough when they are all the same.
    const units = (text(col(row, 'UNITE_DOSAGE1', 'UNITE_DOSAGE')) || '').split('/').map(u => u.trim()).filter(Boolean);
    const unit = units.length && units.every(u => u === units[0]) ? units[0] : units.join(' / ');
    const dosage = amount ? `${amount}${unit ? ` ${unit}` : ''}` : null;
    const kind = text(col(row, 'PRINCEPS_GENERIQUE'));
    rows.push({
      code: code.slice(0, 190),
      name: fullName(name, dosage).slice(0, 190),
      dci: text(col(row, 'DCI1', 'DCI', 'SUBSTANCE ACTIVE'))?.slice(0, 190) ?? null,
      dosage: dosage?.slice(0, 190) ?? null,
      form: text(col(row, 'FORME'))?.toLowerCase().slice(0, 190) ?? null,
      presentation: text(col(row, 'PRESENTATION'))?.toLowerCase().slice(0, 190) ?? null,
      ppv: num(col(row, 'PPV')),
      refundRate: num(col(row, 'TAUX_REMBOURSEMENT')),
      generic: kind ? kind.toUpperCase().startsWith('G') : false,
    });
  });
  return rows;
}

/** Replaces the whole list (the Drug table is not referenced by other tables). */
export async function replaceDrugs(prisma: PrismaClient, rows: DrugRow[]) {
  await prisma.drug.deleteMany({});
  for (let i = 0; i < rows.length; i += 1000) {
    await prisma.drug.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true });
  }
  return rows.length;
}

/** First start: loads the bundled list when the table is empty. */
export async function ensureDrugs(prisma: PrismaClient) {
  if (await prisma.drug.count()) return 0;
  const file = dataFile();
  if (!file) return 0;
  return replaceDrugs(prisma, JSON.parse(fs.readFileSync(file, 'utf8')) as DrugRow[]);
}
