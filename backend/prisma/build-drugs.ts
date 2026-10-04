import fs from 'fs';
import path from 'path';
import { parseDrugWorkbook } from '../src/services/drugs';

/**
 * Rebuilds prisma/data/drugs-ma.json from the official reference file (XLSX).
 *   npm run db:drugs:build -- <fichier.xlsx>
 * Source: CNOPS "Référentiel des médicaments", data.gov.ma (licence ODbL).
 */
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage : npm run db:drugs:build -- <fichier.xlsx>');
  const rows = await parseDrugWorkbook(fs.readFileSync(file));
  const out = path.join(__dirname, 'data', 'drugs-ma.json');
  fs.writeFileSync(out, '[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]\n');
  console.log(`${rows.length} médicaments -> ${out}`);
}
main().catch(err => { console.error(err.message || err); process.exit(1); });
