/**
 * Kalenderwochen-Berechnung nach ISO 8601 in der Zeitzone Europe/Vienna.
 * Alle Daten werden als reine Kalenderdaten (YYYY-MM-DD) behandelt, damit
 * Sommer-/Winterzeit keine Rolle spielt.
 */

export const TIME_ZONE = "Europe/Vienna";
const DAY = 86_400_000;

export interface IsoWeek {
  year: number; // ISO-Wochenjahr
  week: number; // 1..53
}

export interface WeekRange extends IsoWeek {
  start: string; // Montag, YYYY-MM-DD
  end: string; // Sonntag, YYYY-MM-DD
}

/** Heutiges Datum in Wien als YYYY-MM-DD. */
export function todayInVienna(now: Date = new Date()): string {
  // en-CA liefert ISO-Format YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseDate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Ungültiges Datum: ${date}`);
  return Date.UTC(y, m - 1, d);
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Wochentag nach ISO: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: string): number {
  const day = new Date(parseDate(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isoWeekOf(date: string): IsoWeek {
  const ms = parseDate(date);
  const thursday = ms + (4 - isoWeekday(date)) * DAY;
  const year = new Date(thursday).getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday - jan1) / DAY / 7) + 1;
  return { year, week };
}

export function weeksInIsoYear(year: number): number {
  // Ein Jahr hat 53 Wochen, wenn der 28. Dezember in KW 53 liegt.
  return isoWeekOf(`${year}-12-28`).week;
}

export function weekRange(year: number, week: number): WeekRange {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Ungültiges Jahr");
  if (!Number.isInteger(week) || week < 1 || week > weeksInIsoYear(year)) {
    throw new Error("Ungültige Kalenderwoche");
  }
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Weekday = isoWeekday(formatDate(jan4));
  const mondayWeek1 = jan4 - (jan4Weekday - 1) * DAY;
  const monday = mondayWeek1 + (week - 1) * 7 * DAY;
  return { year, week, start: formatDate(monday), end: formatDate(monday + 6 * DAY) };
}

export function currentWeek(now: Date = new Date()): WeekRange {
  const { year, week } = isoWeekOf(todayInVienna(now));
  return weekRange(year, week);
}

export function shiftWeek(year: number, week: number, delta: number): WeekRange {
  const { start } = weekRange(year, week);
  const shifted = formatDate(parseDate(start) + delta * 7 * DAY);
  const iso = isoWeekOf(shifted);
  return weekRange(iso.year, iso.week);
}

export function addDays(date: string, days: number): string {
  return formatDate(parseDate(date) + days * DAY);
}

export interface NextMeeting {
  date: string;
  kind: "midweek" | "weekend";
  label: string;
}

/**
 * Nächste Zusammenkunft ab heute (inklusive heute).
 * midweekDay/weekendDay: 1 = Montag … 7 = Sonntag.
 */
export function nextMeeting(
  midweekDay: number,
  weekendDay: number,
  now: Date = new Date(),
): NextMeeting {
  const today = todayInVienna(now);
  const wd = isoWeekday(today);
  const until = (target: number) => (target - wd + 7) % 7;
  const dMid = until(midweekDay);
  const dEnd = until(weekendDay);
  if (dMid <= dEnd) {
    return { date: addDays(today, dMid), kind: "midweek", label: "Zusammenkunft unter der Woche" };
  }
  return { date: addDays(today, dEnd), kind: "weekend", label: "Zusammenkunft am Wochenende" };
}

const LONG = new Intl.DateTimeFormat("de-AT", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const SHORT = new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", day: "numeric", month: "long" });

export function formatLong(date: string): string {
  return LONG.format(new Date(parseDate(date)));
}

export function formatRange(start: string, end: string): string {
  const s = new Date(parseDate(start));
  const e = new Date(parseDate(end));
  const sameMonth = s.getUTCMonth() === e.getUTCMonth();
  const startText = sameMonth ? `${s.getUTCDate()}.` : SHORT.format(s);
  return `${startText}–${SHORT.format(e)} ${e.getUTCFullYear()}`;
}

export const WEEKDAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;
