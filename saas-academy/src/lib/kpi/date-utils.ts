/**
 * src/lib/kpi/date-utils.ts
 *
 * KST-aware date range helpers for KPI queries.
 *
 * All "day" boundaries are computed in Asia/Seoul (UTC+9).
 * DB stores:
 *   - ClassSession.localDate : "YYYY-MM-DD" string in KST
 *   - Invoice.dueDate        : @db.Date (treated as KST calendar date)
 *   - Invoice.paidAt         : timestamptz  → we filter to KST day range
 *   - User.createdAt         : timestamptz  → KST day range
 *   - Attendance records     → joined through ClassSession.localDate
 */

export const KST_TZ = "Asia/Seoul";

export interface DateRange {
  from: string; // "YYYY-MM-DD"
  to:   string; // "YYYY-MM-DD"
}

/**
 * Returns { from, to } for the current calendar month in KST.
 */
export function currentMonthKST(): DateRange {
  const now = new Date();
  // Format today in KST
  const kstStr = now.toLocaleDateString("en-CA", { timeZone: KST_TZ }); // "YYYY-MM-DD"
  const [year, month] = kstStr.split("-").map(Number);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate(); // month+1, day 0 = last day of month
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

/**
 * Returns the KST "YYYY-MM-DD" string for today.
 */
export function todayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: KST_TZ });
}

/**
 * Parse "YYYY-MM-DD" → UTC Date at the start of that KST day (00:00:00 KST = prev day 15:00 UTC).
 */
export function kstDayStartUTC(ymd: string): Date {
  // Append T00:00:00+09:00 to get midnight KST
  return new Date(`${ymd}T00:00:00+09:00`);
}

/**
 * Parse "YYYY-MM-DD" → UTC Date at the END of that KST day (23:59:59.999 KST).
 */
export function kstDayEndUTC(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+09:00`);
}

/**
 * Returns a Date N days before today (KST midnight).
 */
export function daysAgoUTC(n: number): Date {
  const today = todayKST();
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - n));
  // Shift to KST midnight: subtract 9h (UTC) to get start of KST day
  return new Date(`${formatYMD(dt)}T00:00:00+09:00`);
}

/**
 * Add N days to a "YYYY-MM-DD" string, return "YYYY-MM-DD".
 */
export function addDaysToYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return formatYMD(dt);
}

/**
 * Enumerate all "YYYY-MM-DD" day strings in [from, to] inclusive.
 */
export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  let cur = from;
  while (cur <= to) {
    days.push(cur);
    cur = addDaysToYMD(cur, 1);
  }
  return days;
}

/**
 * Enumerate ISO-week start dates (Monday) covering [from, to].
 * Returns "YYYY-MM-DD" strings for each Monday.
 */
export function enumerateWeekStarts(from: string, to: string): string[] {
  const weeks: string[] = [];
  // Find the Monday of the week containing `from`
  const [fy, fm, fd] = from.split("-").map(Number);
  const startDt = new Date(Date.UTC(fy, fm - 1, fd));
  const dow = startDt.getUTCDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow; // shift to Monday
  startDt.setUTCDate(startDt.getUTCDate() + offset);

  let cur = formatYMD(startDt);
  while (cur <= to) {
    weeks.push(cur);
    cur = addDaysToYMD(cur, 7);
  }
  return weeks;
}

/**
 * Format a Date as "YYYY-MM-DD" (UTC).
 */
export function formatYMD(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/**
 * Validate a "YYYY-MM-DD" string. Throws on invalid.
 */
export function assertValidYMD(s: string, name: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`${name} must be YYYY-MM-DD, got: ${s}`);
  }
}
