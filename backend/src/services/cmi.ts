import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * CMI (Centre Monétique Interbancaire) hosted payment page, "3D_PAY_HOSTING" with hash version 3.
 * The browser posts a signed form to the CMI page; CMI then calls our callback (server to server) with the result,
 * signed the same way, and sends the payer back to okUrl / failUrl.
 *
 * Hash v3: parameter names sorted alphabetically (case-insensitive), "hash" and "encoding" left out, every value
 * escaped ("\" -> "\\", "|" -> "\|") and joined with "|", then the escaped store key appended; SHA-512, base64.
 */
export const cmiConfig = () => ({
  clientId: process.env.CMI_CLIENT_ID || '',
  storeKey: process.env.CMI_STORE_KEY || '',
  gatewayUrl: process.env.CMI_GATEWAY_URL || 'https://testpayment.cmi.co.ma/fim/est3Dgate',
});
export const cmiConfigured = () => !!(cmiConfig().clientId && cmiConfig().storeKey);

const escape = (v: string) => v.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');

export function cmiHash(params: Record<string, string>, storeKey: string) {
  const names = Object.keys(params)
    .filter(k => !['hash', 'encoding'].includes(k.toLowerCase()))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'en'));
  const plain = names.map(k => escape(String(params[k] ?? '').trim())).join('|') + '|' + escape(storeKey);
  return createHash('sha512').update(plain, 'utf8').digest('base64');
}

export function verifyCmiHash(params: Record<string, string>, storeKey: string) {
  const received = params.HASH || params.hash || '';
  const expected = cmiHash(params, storeKey);
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Fields of the form posted by the browser to the CMI payment page. */
export function cmiForm(input: {
  orderId: string; amount: number; okUrl: string; failUrl: string; callbackUrl: string; shopUrl: string
  email?: string | null; phone?: string | null; name: string; lang?: 'fr' | 'ar' | 'en'
}) {
  const { clientId, storeKey, gatewayUrl } = cmiConfig();
  const fields: Record<string, string> = {
    clientid: clientId,
    amount: input.amount.toFixed(2),
    currency: '504', // MAD
    oid: input.orderId,
    okUrl: input.okUrl,
    failUrl: input.failUrl,
    callbackUrl: input.callbackUrl,
    shopurl: input.shopUrl,
    TranType: 'PreAuth',
    storetype: '3D_PAY_HOSTING',
    hashAlgorithm: 'ver3',
    rnd: randomBytes(10).toString('hex'),
    lang: input.lang || 'fr',
    refreshtime: '5',
    encoding: 'UTF-8',
    AutoRedirect: 'true',
    BillToName: input.name.slice(0, 60),
    email: input.email || '',
    tel: input.phone || '',
  };
  fields.hash = cmiHash(fields, storeKey);
  return { url: gatewayUrl, fields };
}
