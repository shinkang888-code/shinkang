/**
 * src/lib/alimtalk/quiet-hours.ts
 *
 * Quiet-hours enforcement for attendance notifications (Asia/Seoul KST).
 *
 * "Quiet hours" = window where NO messages should be sent.
 * Config stored as HH:mm strings (e.g. "21:00" / "08:00").
 *
 * Edge case: quiet window that crosses midnight (e.g. 21:00–08:00).
 *   → isInQuietHours handles wrap-around.
 */

/**
 * Returns true if the current KST wall-clock time falls inside the quiet window.
 *
 * @param quietStart  e.g. "21:00"
 * @param quietEnd    e.g. "08:00"
 * @param now         Optional: pass a specific Date for testing (default: Date.now())
 */
export function isInQuietHours(
  quietStart: string,
  quietEnd:   string,
  now:        Date = new Date(),
): boolean {
  const kstNow = toKSTMinutes(now);
  const start  = parseHHmm(quietStart);
  const end    = parseHHmm(quietEnd);

  if (start === end) return false; // zero-length window → never quiet

  if (start < end) {
    // Simple window within the same day, e.g. 09:00–17:00
    return kstNow >= start && kstNow < end;
  } else {
    // Cross-midnight window, e.g. 21:00–08:00
    return kstNow >= start || kstNow < end;
  }
}

/**
 * Returns the next Date (UTC) when the quiet window ends (i.e. quietEnd in KST).
 * Useful for scheduling nextRetryAt.
 */
export function nextQuietHoursEnd(quietEnd: string, now: Date = new Date()): Date {
  const [hh, mm] = quietEnd.split(":").map(Number);

  // Get today's date in KST
  const kstFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const kstDateStr = kstFormatter.format(now); // "YYYY-MM-DD"
  const [year, month, day] = kstDateStr.split("-").map(Number);

  // Construct the end time today in KST, then convert to UTC
  // We use a dummy approach: build the ISO string for KST and let Date parse it.
  const candidate = new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`,
  );

  // If that time is already in the past, advance by 1 day
  if (candidate <= now) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  return candidate;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Convert HH:mm string to total minutes since midnight */
function parseHHmm(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Get current KST wall-clock as minutes since midnight */
function toKSTMinutes(date: Date): number {
  // Extract KST hour/minute
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour:     "numeric",
    minute:   "numeric",
    hour12:   false,
  }).formatToParts(date);

  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}
