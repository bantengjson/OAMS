/**
 * Calendar-date helpers pinned to Asia/Jakarta. Dates compared by day
 * (overdue loans, "not in the future") must all go through here so the
 * backend and the stored `date` columns agree on what "today" is.
 */

const TZ = 'Asia/Jakarta';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `YYYY-MM-DD` of `now` as seen on a Jakarta calendar. */
export function jakartaToday(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

/** `YYYY-MM-DD` of a date-only value (Prisma `@db.Date` comes back as UTC midnight). */
export function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Calendar days from `fromIso` to `toIso` (negative when `to` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(...splitIso(fromIso));
  const to = Date.UTC(...splitIso(toIso));
  return Math.round((to - from) / 86_400_000);
}

/** Days past `dueAt` on the Jakarta calendar; 0 when due today or later. */
export function daysOverdue(dueAt: Date, now: Date = new Date()): number {
  return Math.max(0, daysBetween(isoDateOnly(dueAt), jakartaToday(now)));
}

function splitIso(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m - 1, d];
}
