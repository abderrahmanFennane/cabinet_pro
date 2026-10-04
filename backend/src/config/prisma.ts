import { PrismaClient } from '@prisma/client';
import { decryptDeep, encryptData, ENCRYPTED_FIELDS } from '../utils/crypto';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  // Medical fields are encrypted on every write and decrypted on every read, so the rest of the code
  // only ever sees plain text (see utils/crypto.ts for the list of fields).
  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const a: any = args;
          if (model && ENCRYPTED_FIELDS[model] && a) {
            if (['create', 'update', 'updateMany', 'createMany', 'createManyAndReturn'].includes(operation) && a.data) a.data = encryptData(model, a.data);
            if (operation === 'upsert') {
              if (a.create) a.create = encryptData(model, a.create);
              if (a.update) a.update = encryptData(model, a.update);
            }
          }
          return decryptDeep(await query(args));
        },
      },
    },
  });
  // Same API as the plain client for the rest of the code (transactions included).
  return extended as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
