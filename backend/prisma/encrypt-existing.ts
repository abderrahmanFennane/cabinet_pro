import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { ENCRYPTED_FIELDS, isEncrypted } from '../src/utils/crypto';

/**
 * Encrypts medical fields saved in plain text before encryption at rest was enabled.
 * Safe to run several times: values already encrypted are skipped.  npm run db:encrypt
 */
const raw = new PrismaClient(); // reads the stored values as they are, to see which ones are still plain text

const delegate = (client: any, model: string) => client[model.charAt(0).toLowerCase() + model.slice(1)];

async function main() {
  for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    let updated = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows: any[] = await delegate(raw, model).findMany({
        select: Object.fromEntries([['id', true], ...fields.map(f => [f, true])]),
        orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      for (const row of rows) {
        const plain = fields.filter(f => typeof row[f] === 'string' && row[f] !== '' && !isEncrypted(row[f]));
        if (!plain.length) continue;
        // The application client encrypts these fields on write.
        await delegate(prisma, model).update({ where: { id: row.id }, data: Object.fromEntries(plain.map(f => [f, row[f]])) });
        updated++;
      }
    }
    console.log(`${model.padEnd(22)} ${updated} ligne(s) chiffrée(s)`);
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await raw.$disconnect(); await prisma.$disconnect(); });
