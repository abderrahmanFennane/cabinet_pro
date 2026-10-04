/** Calendar days in the clinic's time zone (Morocco: UTC+1, UTC+0 during Ramadan), whatever the server's zone. */
export const TIME_ZONE = process.env.APP_TIMEZONE || 'Africa/Casablanca';

/** Minutes to add to UTC to get local time at that instant. */
function offsetMinutes(at: Date, timeZone = TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** "2026-10-03" today in the clinic's time zone. */
export function localDay(at = new Date(), timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** UTC instants [start, end) of a local day "YYYY-MM-DD". */
export function dayRange(day: string, timeZone = TIME_ZONE) {
  const [y, m, d] = day.split('-').map(Number);
  const midnight = (yy: number, mm: number, dd: number) => {
    const guess = new Date(Date.UTC(yy, mm - 1, dd));
    return new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60_000);
  };
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return { start: midnight(y, m, d), end: midnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()) };
}
