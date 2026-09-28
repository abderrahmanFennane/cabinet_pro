const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '212';

/**
 * Normalizes a phone number to international digits without "+" (e.g. "212612345678"),
 * the format both Infobip and the WhatsApp Cloud API expect.
 * Local Moroccan numbers ("06 12 34 56 78") get the default country code.
 */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  else if (digits.length <= 9) digits = DEFAULT_COUNTRY_CODE + digits;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}
