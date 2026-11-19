/** Calendar-date helpers pinned to Asia/Jakarta, mirroring the backend. */

const TZ = 'Asia/Jakarta';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `YYYY-MM-DD` of `now` on a Jakarta calendar. */
export function jakartaToday(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Calendar days from `fromIso` to `toIso` (negative when `to` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(dayNumber(toIso) - dayNumber(fromIso));
}

/** Days past a `YYYY-MM-DD` due date; 0 when due today or later. */
export function daysOverdue(dueAtIso: string, now: Date = new Date()): number {
  return Math.max(0, daysBetween(dueAtIso.slice(0, 10), jakartaToday(now)));
}

/** `YYYY-MM-DD` shifted by `days` on the Jakarta calendar (for date inputs). */
export function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Local `datetime-local` value (minute precision) for "now". */
export function nowForDateTimeInput(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
