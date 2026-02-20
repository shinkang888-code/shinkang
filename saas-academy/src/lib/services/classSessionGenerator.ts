/**
 * src/lib/services/classSessionGenerator.ts
 *
 * Generates ClassSession rows for a given Class + ClassSchedule.
 * All times are stored as UTC; localDate is the YYYY-MM-DD in Asia/Seoul.
 *
 * Rules:
 *  - Only creates sessions in [dateFrom, dateTo].
 *  - Skips dates that already have a session (classId + startsAt unique).
 *  - "Regenerate future" mode: deletes SCHEDULED sessions after today
 *    that have NO attendance, then re-creates from new schedule.
 *  - Never deletes COMPLETED / CANCELED sessions or sessions with attendance.
 */
import { prisma } from "@/lib/db/client";
import type { ClassSchedule, SessionStatus } from "@prisma/client";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9

/** Convert a UTC Date to "YYYY-MM-DD" in Asia/Seoul */
function toKSTDateStr(utc: Date): string {
  return utc.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/**
 * Parse "HH:mm" -> { hours, minutes }
 */
function parseTime(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { hours: h, minutes: m };
}

/**
 * Given a schedule rule, yield all Date objects (UTC startsAt) in [dateFrom, dateTo].
 */
function* scheduledDates(
  schedule: Pick<ClassSchedule, "daysOfWeek" | "startTime" | "durationMin" | "timezone">,
  dateFrom: Date,
  dateTo: Date,
): Generator<{ startsAt: Date; endsAt: Date; localDate: string }> {
  const { hours, minutes } = parseTime(schedule.startTime);
  // Walk day-by-day from dateFrom to dateTo
  const cursor = new Date(dateFrom);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(dateTo);
  end.setUTCHours(23, 59, 59, 999);

  while (cursor <= end) {
    // Get the KST day-of-week for this UTC day
    // We compute by converting cursor to KST midnight
    const kstMidnight = new Date(cursor.getTime() + KST_OFFSET_MS);
    const kstDow = kstMidnight.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat

    if (schedule.daysOfWeek.includes(kstDow)) {
      // Build the startsAt in KST, then convert to UTC
      // KST date = cursor date (since we're iterating in KST midnight context)
      const kstDateStr = toKSTDateStr(cursor);
      const [yr, mo, dy] = kstDateStr.split("-").map(Number);

      // KST time as UTC epoch
      const kstStartEpoch = Date.UTC(yr, mo - 1, dy, hours, minutes, 0, 0) - KST_OFFSET_MS;
      const startsAt = new Date(kstStartEpoch);
      const endsAt   = new Date(kstStartEpoch + schedule.durationMin * 60_000);
      const localDate = kstDateStr;

      yield { startsAt, endsAt, localDate };
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

export interface GenerateOptions {
  classId:   string;
  academyId: string;
  dateFrom:  Date;
  dateTo:    Date;
}

/** Create new sessions (no-op for duplicates). Returns count of created rows. */
export async function generateSessions(opts: GenerateOptions): Promise<number> {
  const { classId, academyId, dateFrom, dateTo } = opts;

  const schedules = await prisma.classSchedule.findMany({
    where: { classId, academyId },
  });
  if (schedules.length === 0) return 0;

  let created = 0;
  for (const schedule of schedules) {
    for (const slot of scheduledDates(schedule, dateFrom, dateTo)) {
      // upsert – ignore if already exists
      const existing = await prisma.classSession.findUnique({
        where: { classId_startsAt: { classId, startsAt: slot.startsAt } },
      });
      if (existing) continue;

      await prisma.classSession.create({
        data: {
          academyId,
          classId,
          startsAt:  slot.startsAt,
          endsAt:    slot.endsAt,
          localDate: slot.localDate,
          status:    "SCHEDULED",
        },
      });
      created++;
    }
  }
  return created;
}

/**
 * Regenerate future sessions:
 *  1. Collect all SCHEDULED sessions after `safeAfter` (default: now) that have 0 attendance.
 *  2. Delete those.
 *  3. Call generateSessions for the future range.
 * Returns { deleted, created }.
 */
export async function regenerateFutureSessions(
  opts: GenerateOptions & { safeAfter?: Date },
): Promise<{ deleted: number; created: number; skippedWithAttendance: number }> {
  const { classId, academyId, dateFrom, dateTo, safeAfter } = opts;
  const cutoff = safeAfter ?? new Date();

  // Find SCHEDULED future sessions with no attendance
  const candidates = await prisma.classSession.findMany({
    where: {
      classId,
      academyId,
      status:   "SCHEDULED",
      startsAt: { gt: cutoff },
    },
    include: { _count: { select: { attendances: true } } },
  });

  const toDelete   = candidates.filter((s) => s._count.attendances === 0);
  const skipped    = candidates.filter((s) => s._count.attendances > 0);

  if (toDelete.length > 0) {
    await prisma.classSession.deleteMany({
      where: { id: { in: toDelete.map((s) => s.id) } },
    });
  }

  // Regenerate from cutoff to dateTo
  const from = cutoff > dateFrom ? cutoff : dateFrom;
  const created = await generateSessions({ classId, academyId, dateFrom: from, dateTo });

  return { deleted: toDelete.length, created, skippedWithAttendance: skipped.length };
}
