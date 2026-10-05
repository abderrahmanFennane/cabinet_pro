import 'dotenv/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Encryption at rest of medical content (spec section 10: "chiffrement au repos des champs médicaux").
 * AES-256-GCM, a fresh random IV per value, stored as "enc:v1:<base64(iv|tag|ciphertext)>".
 * Values without the prefix are plain text written before encryption was enabled: they are read as they are
 * and encrypted the next time they are saved (or by `npm run db:encrypt`).
 */
const PREFIX = 'enc:v1:';

function loadKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY doit être une clé de 32 octets encodée en base64 (openssl rand -base64 32)');
    return key;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('DATA_ENCRYPTION_KEY doit être défini en production');
  // Development only: a key derived from the JWT secret, so a fresh checkout works out of the box.
  console.warn('[crypto] DATA_ENCRYPTION_KEY absent : clé de développement dérivée de JWT_SECRET (à ne pas utiliser en production)');
  return createHash('sha256').update(`cabinet-pro-dev:${process.env.JWT_SECRET || 'fallback_secret_change_me'}`).digest();
}

let key: Buffer | null = null;
const getKey = () => (key ??= loadKey());

export const isEncrypted = (value: unknown): value is string => typeof value === 'string' && value.startsWith(PREFIX);

export function encrypt(plain: string): string {
  if (isEncrypted(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/** Decrypts every encrypted string found in a query result (objects, arrays, nested relations). */
export function decryptDeep<T>(value: T): T {
  if (isEncrypted(value)) return decrypt(value) as T;
  if (Array.isArray(value)) return value.map(decryptDeep) as T;
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value) && value.constructor?.name !== 'Decimal') {
    for (const k of Object.keys(value)) (value as any)[k] = decryptDeep((value as any)[k]);
  }
  return value;
}

/** Fields stored encrypted, per model. Medical content only: names, phone and CIN stay searchable. */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  Patient: ['medicalHistory', 'surgicalHistory', 'familyHistory', 'currentTreatments', 'allergies', 'notes'],
  Appointment: ['comment'],
  Consultation: ['reason', 'examination', 'vitals', 'diagnosis', 'plan', 'notes'],
  ConsultationRevision: ['content'],
  Prescription: ['items', 'notes'],
  MedicalDocument: ['body'],
  ToothState: ['notes'],
  DentalAct: ['notes'],
  TreatmentPlan: ['notes'],
  ClinicalRecord: ['data'],
  User: ['totpSecret'],
};

/** Encrypts the protected fields of one `data` object (or of each item of a createMany array). */
export function encryptData(model: string, data: any): any {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !data) return data;
  if (Array.isArray(data)) return data.map(item => encryptData(model, item));
  const out = { ...data };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === 'string' && v !== '') out[f] = encrypt(v);
    else if (v && typeof v === 'object' && typeof v.set === 'string') out[f] = { set: encrypt(v.set) };
  }
  return out;
}
