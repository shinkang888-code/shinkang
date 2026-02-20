/**
 * src/lib/kpi/risk.queries.ts
 *
 * Risk & Operations KPI queries.
 *
 * Definitions (see /docs/kpi-definitions.md):
 *   atRisk student    – ABSENT >= 3 in the last 30 days (rolling, not range param)
 *   delinquent student – has PENDING invoice with dueDate < today - delinquencyDays
 *   notifications     – NotificationQueue counts in range
 */

import { prisma }          from "@/lib/db/client";
import { todayKST, daysAgoUTC, kstDayStartUTC, kstDayEndUTC } from "@/lib/kpi/date-utils";

export interface RiskKPI {
  atRiskStudentsCount:    number;
  delinquentStudentsCount: number;
}

export interface NotifKPI {
  queuedCount: number;
  failedCount: number;
}

// ── Summary counts ────────────────────────────────────────────────────────────

export async function getRiskKPI(
  academyId:       string,
  delinquencyDays = 7,
): Promise<RiskKPI> {
  const [atRiskRows, delinquentRows] = await Promise.all([
    getAtRiskStudents(academyId, 3),
    getDelinquentStudents(academyId, delinquencyDays),
  ]);

  return {
    atRiskStudentsCount:     atRiskRows.length,
    delinquentStudentsCount: delinquentRows.length,
  };
}

export async function getNotifKPI(
  academyId: string,
  from: string,
  to:   string,
): Promise<NotifKPI> {
  const fromUTC = kstDayStartUTC(from);
  const toUTC   = kstDayEndUTC(to);

  const [queuedCount, failedCount] = await Promise.all([
    prisma.notificationQueue.count({
      where: {
        academyId,
        createdAt: { gte: fromUTC, lte: toUTC },
      },
    }),
    prisma.notificationQueue.count({
      where: {
        academyId,
        status:    "FAILED",
        createdAt: { gte: fromUTC, lte: toUTC },
      },
    }),
  ]);

  return { queuedCount, failedCount };
}

// ── Detailed at-risk student list ─────────────────────────────────────────────

export interface AtRiskStudent {
  studentId:       string;
  name:            string;
  absentCount30d:  number;
  lastSessionDate: string | null;
}

export async function getAtRiskStudents(
  academyId:    string,
  threshold = 3,
): Promise<AtRiskStudent[]> {
  const cutoff = daysAgoUTC(30);

  const rows = await prisma.$queryRaw<
    Array<{
      studentId:       string;
      name:            string;
      absentCount30d:  bigint;
      lastSessionDate: string | null;
    }>
  >`
    SELECT
      u.id          AS "studentId",
      u.name,
      COUNT(a.id)::bigint AS "absentCount30d",
      MAX(s."localDate")  AS "lastSessionDate"
    FROM attendances a
    JOIN users           u ON u.id  = a."studentUserId"
    JOIN class_sessions  s ON s.id  = a."sessionId"
    WHERE
      a."academyId"  = ${academyId}
      AND a.status   = 'ABSENT'
      AND a."createdAt" >= ${cutoff}
    GROUP BY u.id, u.name
    HAVING COUNT(a.id) >= ${threshold}
    ORDER BY COUNT(a.id) DESC
  `;

  return rows.map((r) => ({
    studentId:       r.studentId,
    name:            r.name,
    absentCount30d:  Number(r.absentCount30d),
    lastSessionDate: r.lastSessionDate ?? null,
  }));
}

// ── Detailed delinquent student list ─────────────────────────────────────────

export interface DelinquentStudent {
  studentId:      string;
  name:           string;
  overdueAmount:  number;
  overdueDaysMax: number;
}

export async function getDelinquentStudents(
  academyId:       string,
  delinquencyDays = 7,
): Promise<DelinquentStudent[]> {
  const today   = todayKST();
  // Calculate cutoff date: dueDate < today - delinquencyDays
  const cutoffDate = new Date(`${today}T00:00:00+09:00`);
  cutoffDate.setDate(cutoffDate.getDate() - delinquencyDays);

  const rows = await prisma.$queryRaw<
    Array<{
      studentId:      string;
      name:           string;
      overdueAmount:  bigint;
      overdueDaysMax: number;
    }>
  >`
    SELECT
      u.id            AS "studentId",
      u.name,
      SUM(i.amount)::bigint                          AS "overdueAmount",
      MAX(CURRENT_DATE - i."dueDate"::date)::integer AS "overdueDaysMax"
    FROM invoices i
    JOIN users u ON u.id = i."studentUserId"
    WHERE
      i."academyId"  = ${academyId}
      AND i.status   = 'PENDING'
      AND i."dueDate" < ${cutoffDate}
    GROUP BY u.id, u.name
    ORDER BY SUM(i.amount) DESC
  `;

  return rows.map((r) => ({
    studentId:      r.studentId,
    name:           r.name,
    overdueAmount:  Number(r.overdueAmount),
    overdueDaysMax: Number(r.overdueDaysMax),
  }));
}
