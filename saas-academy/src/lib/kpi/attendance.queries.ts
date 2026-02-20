/**
 * src/lib/kpi/attendance.queries.ts
 *
 * Attendance KPI queries scoped to academyId + KST date range.
 *
 * Definitions (see /docs/kpi-definitions.md):
 *   scheduledSessions  – ClassSession with status != CANCELED, localDate in [from, to]
 *   completedSessions  – ClassSession with status = COMPLETED, localDate in [from, to]
 *
 *   attendanceRate     = (PRESENT + LATE) / denominator
 *     denominator (default): PRESENT + LATE + ABSENT   (EXCUSED excluded)
 *     set excludeExcused=false to include EXCUSED in denominator
 *
 *   lateRate           = LATE / (PRESENT + LATE + ABSENT)
 *
 * Teacher KPIs:
 *   Sessions per teacher (top N)
 *   Attendance rate per teacher (top N)
 */

import { prisma } from "@/lib/db/client";

export interface AttendanceKPI {
  scheduledSessions: number;
  completedSessions: number;
  attendanceRate:    number; // 0-1
  lateRate:          number; // 0-1
  activeTeachers:    number;
}

export async function getAttendanceKPI(
  academyId: string,
  from: string,
  to:   string,
  excludeExcused = true,
): Promise<AttendanceKPI> {
  // Session counts
  const [scheduledSessions, completedSessions] = await Promise.all([
    prisma.classSession.count({
      where: {
        academyId,
        status:    { not: "CANCELED" },
        localDate: { gte: from, lte: to },
      },
    }),
    prisma.classSession.count({
      where: {
        academyId,
        status:    "COMPLETED",
        localDate: { gte: from, lte: to },
      },
    }),
  ]);

  // Attendance counts via groupBy
  const attendanceCounts = await prisma.attendance.groupBy({
    by:    ["status"],
    where: {
      academyId,
      session: { localDate: { gte: from, lte: to } },
    },
    _count: { id: true },
  });

  const countMap: Record<string, number> = {};
  for (const row of attendanceCounts) {
    countMap[row.status] = row._count.id;
  }

  const present = countMap["PRESENT"] ?? 0;
  const late    = countMap["LATE"]    ?? 0;
  const absent  = countMap["ABSENT"]  ?? 0;
  const excused = countMap["EXCUSED"] ?? 0;

  const numerator   = present + late;
  const denominator = excludeExcused
    ? present + late + absent
    : present + late + absent + excused;

  const attendanceRate = denominator > 0 ? numerator / denominator : 0;
  const lateRate       = (present + late + absent) > 0
    ? late / (present + late + absent)
    : 0;

  // Active teachers: distinct teacherUserId on non-archived classes with sessions in range
  const teacherRows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(DISTINCT c."teacherUserId")::bigint AS cnt
    FROM class_sessions s
    JOIN classes c ON c.id = s."classId"
    WHERE
      s."academyId" = ${academyId}
      AND s.status  != 'CANCELED'
      AND s."localDate" >= ${from}
      AND s."localDate" <= ${to}
      AND c."teacherUserId" IS NOT NULL
  `;
  const activeTeachers = Number(teacherRows[0]?.cnt ?? BigInt(0));

  return {
    scheduledSessions,
    completedSessions,
    attendanceRate: Math.round(attendanceRate * 10_000) / 10_000,
    lateRate:       Math.round(lateRate * 10_000) / 10_000,
    activeTeachers,
  };
}

// ── Top teachers ─────────────────────────────────────────────────────────────

export interface TeacherSessionRow {
  teacherId:   string;
  teacherName: string;
  sessions:    number;
}

export interface TeacherAttendanceRow {
  teacherId:      string;
  teacherName:    string;
  attendanceRate: number;
  totalSessions:  number;
}

/** Top N teachers by number of sessions taught in range */
export async function getTopTeachersBySessions(
  academyId: string,
  from: string,
  to:   string,
  limit = 5,
): Promise<TeacherSessionRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{ teacherId: string; teacherName: string; sessions: bigint }>
  >`
    SELECT
      u.id          AS "teacherId",
      u.name        AS "teacherName",
      COUNT(s.id)::bigint AS sessions
    FROM class_sessions s
    JOIN classes c       ON c.id      = s."classId"
    JOIN users   u       ON u.id      = c."teacherUserId"
    WHERE
      s."academyId" = ${academyId}
      AND s.status  != 'CANCELED'
      AND s."localDate" >= ${from}
      AND s."localDate" <= ${to}
    GROUP BY u.id, u.name
    ORDER BY sessions DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    teacherId:   r.teacherId,
    teacherName: r.teacherName,
    sessions:    Number(r.sessions),
  }));
}

/** Top N teachers by attendance rate (PRESENT+LATE / total) in range */
export async function getTopTeachersByAttendanceRate(
  academyId: string,
  from: string,
  to:   string,
  limit = 5,
): Promise<TeacherAttendanceRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      teacherId:      string;
      teacherName:    string;
      presentLate:    bigint;
      totalAttended:  bigint;
    }>
  >`
    SELECT
      u.id   AS "teacherId",
      u.name AS "teacherName",
      COUNT(CASE WHEN a.status IN ('PRESENT','LATE') THEN 1 END)::bigint AS "presentLate",
      COUNT(CASE WHEN a.status IN ('PRESENT','LATE','ABSENT') THEN 1 END)::bigint AS "totalAttended"
    FROM attendances a
    JOIN class_sessions s ON s.id      = a."sessionId"
    JOIN classes c        ON c.id      = s."classId"
    JOIN users   u        ON u.id      = c."teacherUserId"
    WHERE
      a."academyId" = ${academyId}
      AND s."localDate" >= ${from}
      AND s."localDate" <= ${to}
    GROUP BY u.id, u.name
    HAVING COUNT(CASE WHEN a.status IN ('PRESENT','LATE','ABSENT') THEN 1 END) > 0
    ORDER BY (COUNT(CASE WHEN a.status IN ('PRESENT','LATE') THEN 1 END)::float /
              NULLIF(COUNT(CASE WHEN a.status IN ('PRESENT','LATE','ABSENT') THEN 1 END), 0)) DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => {
    const pl    = Number(r.presentLate);
    const total = Number(r.totalAttended);
    return {
      teacherId:      r.teacherId,
      teacherName:    r.teacherName,
      attendanceRate: total > 0 ? Math.round((pl / total) * 10_000) / 10_000 : 0,
      totalSessions:  total,
    };
  });
}

// ── Attendance-rate timeseries ────────────────────────────────────────────────

export interface AttendanceTimePoint {
  date:  string;
  value: number; // rate 0-1
}

export async function getAttendanceRateDailyTimeseries(
  academyId: string,
  from: string,
  to:   string,
): Promise<AttendanceTimePoint[]> {
  const rows = await prisma.$queryRaw<
    Array<{ day: string; present_late: bigint; total: bigint }>
  >`
    SELECT
      s."localDate"                                                        AS day,
      COUNT(CASE WHEN a.status IN ('PRESENT','LATE') THEN 1 END)::bigint AS present_late,
      COUNT(CASE WHEN a.status IN ('PRESENT','LATE','ABSENT') THEN 1 END)::bigint AS total
    FROM attendances a
    JOIN class_sessions s ON s.id = a."sessionId"
    WHERE
      a."academyId"  = ${academyId}
      AND s."localDate" >= ${from}
      AND s."localDate" <= ${to}
    GROUP BY s."localDate"
    ORDER BY s."localDate" ASC
  `;

  return rows.map((r) => {
    const pl    = Number(r.present_late);
    const total = Number(r.total);
    return {
      date:  r.day,
      value: total > 0 ? Math.round((pl / total) * 10_000) / 10_000 : 0,
    };
  });
}

export async function getAttendanceRateWeeklyTimeseries(
  academyId: string,
  from: string,
  to:   string,
): Promise<AttendanceTimePoint[]> {
  const rows = await prisma.$queryRaw<
    Array<{ week: Date; present_late: bigint; total: bigint }>
  >`
    SELECT
      date_trunc('week', s."localDate"::date) AS week,
      COUNT(CASE WHEN a.status IN ('PRESENT','LATE') THEN 1 END)::bigint AS present_late,
      COUNT(CASE WHEN a.status IN ('PRESENT','LATE','ABSENT') THEN 1 END)::bigint AS total
    FROM attendances a
    JOIN class_sessions s ON s.id = a."sessionId"
    WHERE
      a."academyId"  = ${academyId}
      AND s."localDate" >= ${from}
      AND s."localDate" <= ${to}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((r) => {
    const pl    = Number(r.present_late);
    const total = Number(r.total);
    return {
      date:  r.week.toISOString().slice(0, 10),
      value: total > 0 ? Math.round((pl / total) * 10_000) / 10_000 : 0,
    };
  });
}
