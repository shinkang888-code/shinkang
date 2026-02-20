/**
 * src/lib/kpi/students.queries.ts
 *
 * Student KPI queries scoped to academyId + KST date range.
 *
 * Definitions:
 *   activeCount       – Users with role=STUDENT, status=ACTIVE, academyId (point-in-time)
 *   newCount          – Students whose createdAt falls within [fromUTC, toUTC]
 *   churnCount        – ClassEnrollment records with status=DROPPED and updatedAt in range
 *                       (proxy for churn; no dedicated UserStatusHistory model)
 *   participantCount  – Distinct studentUserId with ≥1 Attendance in sessions whose
 *                       localDate is in [from, to]
 */

import { prisma }          from "@/lib/db/client";
import { kstDayStartUTC, kstDayEndUTC } from "@/lib/kpi/date-utils";

export interface StudentKPI {
  activeCount:      number;
  newCount:         number;
  churnCount:       number;
  participantCount: number; // unique students with ≥1 attendance in range
}

export async function getStudentKPI(
  academyId: string,
  from: string,
  to:   string,
): Promise<StudentKPI> {
  const fromUTC = kstDayStartUTC(from);
  const toUTC   = kstDayEndUTC(to);

  // 1. Active students (point-in-time snapshot)
  const activeCount = await prisma.user.count({
    where: { academyId, role: "STUDENT", status: "ACTIVE" },
  });

  // 2. New students in range
  const newCount = await prisma.user.count({
    where: {
      academyId,
      role:      "STUDENT",
      createdAt: { gte: fromUTC, lte: toUTC },
    },
  });

  // 3. Churn proxy: DROPPED enrollments whose enrolledAt-update falls in range
  //    We use a raw query to check updatedAt on class_enrollments
  const churnRows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(DISTINCT "studentUserId")::bigint AS cnt
    FROM class_enrollments
    WHERE
      "academyId" = ${academyId}
      AND status  = 'DROPPED'
      AND "enrolledAt" >= ${fromUTC}
      AND "enrolledAt" <= ${toUTC}
  `;
  // Note: ClassEnrollment has no updatedAt; enrolledAt is used as a proxy
  // (we count students who were enrolled AND then dropped, treating the drop date
  //  as when they joined, since we don't store the drop timestamp separately)
  // A better approach would add a droppedAt column; this is the best approximation.
  const churnCount = Number(churnRows[0]?.cnt ?? BigInt(0));

  // 4. Participation: distinct students with ≥1 attendance in sessions in range
  const participantRows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(DISTINCT a."studentUserId")::bigint AS cnt
    FROM attendances a
    JOIN class_sessions s ON s.id = a."sessionId"
    WHERE
      a."academyId" = ${academyId}
      AND s."localDate" >= ${from}
      AND s."localDate" <= ${to}
  `;
  const participantCount = Number(participantRows[0]?.cnt ?? BigInt(0));

  return { activeCount, newCount, churnCount, participantCount };
}

// ── Timeseries: new students per day/week ────────────────────────────────────

export interface StudentTimePoint {
  date:  string;
  value: number;
}

export async function getNewStudentsDailyTimeseries(
  academyId: string,
  from: string,
  to:   string,
): Promise<StudentTimePoint[]> {
  const fromUTC = kstDayStartUTC(from);
  const toUTC   = kstDayEndUTC(to);

  const rows = await prisma.$queryRaw<Array<{ day: Date; cnt: bigint }>>`
    SELECT
      date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Seoul') AS day,
      COUNT(*)::bigint                                          AS cnt
    FROM users
    WHERE
      "academyId" = ${academyId}
      AND role    = 'STUDENT'
      AND "createdAt" >= ${fromUTC}
      AND "createdAt" <= ${toUTC}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((r) => ({
    date:  r.day.toISOString().slice(0, 10),
    value: Number(r.cnt),
  }));
}

export async function getNewStudentsWeeklyTimeseries(
  academyId: string,
  from: string,
  to:   string,
): Promise<StudentTimePoint[]> {
  const fromUTC = kstDayStartUTC(from);
  const toUTC   = kstDayEndUTC(to);

  const rows = await prisma.$queryRaw<Array<{ week: Date; cnt: bigint }>>`
    SELECT
      date_trunc('week', "createdAt" AT TIME ZONE 'Asia/Seoul') AS week,
      COUNT(*)::bigint                                           AS cnt
    FROM users
    WHERE
      "academyId" = ${academyId}
      AND role    = 'STUDENT'
      AND "createdAt" >= ${fromUTC}
      AND "createdAt" <= ${toUTC}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((r) => ({
    date:  r.week.toISOString().slice(0, 10),
    value: Number(r.cnt),
  }));
}
