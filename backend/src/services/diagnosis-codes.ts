import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { ICD10_STARTER } from '../data/icd10';

const CODE = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;

/** Adds the starter codes that are missing (an imported list is kept as it is). */
export async function ensureDiagnosisCodes(prisma: PrismaClient) {
  const { count } = await prisma.diagnosisCode.createMany({
    data: ICD10_STARTER.map(([code, label, chapter]) => ({ code, label, chapter })),
    skipDuplicates: true,
  });
  return count;
}

/** Reads a code list: Excel or CSV, columns CODE and LIBELLE (or LABEL), optional CHAPITRE. */
export async function parseDiagnosisFile(buffer: Buffer, fileName: string) {
  let rows: string[][];
  if (buffer.subarray(0, 2).equals(Buffer.from('PK'))) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    rows = [];
    wb.worksheets[0]?.eachRow(r => rows.push((r.values as unknown[]).slice(1).map(v => String(v ?? '').trim())));
  } else {
    const text = buffer.toString('utf8').replace(/^﻿/, '');
    const sep = (text.split('\n', 1)[0].match(/;/g) || []).length ? ';' : (text.includes('\t') ? '\t' : ',');
    rows = text.split(/\r?\n/).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim()));
  }
  if (!rows.length) throw new Error(`Fichier vide : ${fileName}`);
  const header = (rows[0] || []).map(h => h.toUpperCase());
  const ci = header.findIndex(h => h === 'CODE');
  const li = header.findIndex(h => ['LIBELLE', 'LIBELLÉ', 'LABEL', 'DESIGNATION', 'DÉSIGNATION'].includes(h));
  const hi = header.findIndex(h => ['CHAPITRE', 'CHAPTER'].includes(h));
  if (ci < 0 || li < 0) throw new Error('Colonnes CODE et LIBELLE introuvables sur la première ligne');
  const seen = new Set<string>();
  const codes: { code: string; label: string; chapter: string | null }[] = [];
  for (const r of rows.slice(1)) {
    // "J029" or "J02.9" are both accepted
    let code = (r[ci] || '').toUpperCase().replace(/\s/g, '');
    if (/^[A-Z][0-9]{3,6}$/.test(code)) code = `${code.slice(0, 3)}.${code.slice(3)}`;
    const label = (r[li] || '').slice(0, 190);
    if (!CODE.test(code) || !label || seen.has(code)) continue;
    seen.add(code);
    codes.push({ code, label, chapter: hi >= 0 ? (r[hi] || null) : null });
  }
  return codes;
}
