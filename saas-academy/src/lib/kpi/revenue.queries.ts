/**
 * src/lib/kpi/revenue.queries.ts
 *
 * Revenue KPI queries scoped to academyId + KST date range.
 *
 * Recognition rule:
 *   PAID  → invoices where status='PAID'  and paidAt IN [fromUTC, toUTC]
 *   OUTSTANDING → status='PENDING' and dueDate (KST) IN [from, to]
 *   FAILED → status='FAILED' and updatedAt IN [fromUTC, toUTC]
 *
 * All monetary values in KRW (integer).
 */

import { prisma } from "@/lib/db/client";
import { kstDayStartUTC, kstDayEndUTC } from "@/lib/kpi/date-utils";

export interface RevenueKPI {
  totalPaidAmount:    number;
  paidCount:          number;
  outstandingAmount:  number;
  outstandingCount:   number;
  failedCount:        number;
  collectionRate:     number; // 0-1; paid / (paid + outstanding)
}

export async function getRevenueKPI(
  academyId: string,
  from: string,  // "YYYY-MM-DD"
  to:   string,
): Promise<RevenueKPI> {
  const fromUTC = kstDayStartUTC(from);
  const toUTC   = kstDayEndUTC(to);

  // PAID invoices: paidAt within range
  const paidResult = await prisma.invoice.aggregate({
    where: {
      academyId,
      status: "PAID",
      paidAt: { gte: fromUTC, lte: toUTC },
    },
    _sum:   { amount: true },
    _count: { id: true },
  });

  // PENDING invoices: dueDate (KST string) within range
  const pendingResult = await prisma.invoice.aggregate({
    where: {
      academyId,
      status:  "PENDING",
      dueDate: { gte: fromUTC, lte: toUTC },
    },
    _sum:   { amount: true },
    _count: { id: true },
  });

  // FAILED invoices updated within range
  const failedCount = await prisma.invoice.count({
    where: {
      academyId,
      status:    "FAILED",
      updatedAt: { gte: fromUTC, lte: toUTC },
    },
  });

  const totalPaidAmount   = paidResult._sum.amount    ?? 0;
  const paidCount         = paidResult._count.id      ?? 0;
  const outstandingAmount = pendingResult._sum.amount  ?? 0;
  const outstandingCount  = pendingResult._count.id   ?? 0;

  const denominator = paidCount + outstandingCount;
  const collectionRate = denominator > 0 ? paidCount / denominator : 0;

  return {
    totalPaidAmount,
    paidCount,
    outstandingAmount,
    outstandingCount,
    failedCount,
    collectionRate: Math.round(collectionRate * 10_000) / 10_000, // 4 decimal precision
  };
}

// ── Timeseries: daily paid revenue ──────────────────────────────────────────

export interface RevenueTimePoint {
  date:  string; // "YYYY-MM-DD" KST
  value: number;
}

/**
 * Returns daily sum of paid invoice amounts.
 * Uses $queryRaw for efficient date_trunc grouping.
 */
export async function getRevenueDailyTimeseries(
  academyId: string,
  from: string,
  to:   string,
): Promise<RevenueTimePoint[]> {
  const fromUTC = kstDayStartUTC(from);
  const toUTC   = kstDayEndUTC(to);

  const rows = await prisma.$queryRaw<Array<{ day: Date; total: bigint }>>`
    SELECT
      date_trunc('day', "paidAt" AT TIME ZONE 'Asia/Seoul') AS day,
      SUM(amount)::bigint                                   AS total
    FROM invoices
    WHERE
      "academyId" = ${academyId}
      AND status  = 'PAID'
      AND "paidAt" >= ${fromUTC}
      AND "paidAt" <= ${toUTC}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((r) => ({
    date:  r.day.toISOString().slice(0, 10),
    value: Number(r.total),
  }));
}

/**
 * Returns weekly sum of paid invoice amounts (week starts Monday).
 */
export async function getRevenueWeeklyTimeseries(
  academyId: string,
  from: string,
  to:   string,
): Promise<RevenueTimePoint[]> {
  const fromUTC = kstDayStartUTC(from);
  const toUTC   = kstDayEndUTC(to);

  const rows = await prisma.$queryRaw<Array<{ week: Date; total: bigint }>>`
    SELECT
      date_trunc('week', "paidAt" AT TIME ZONE 'Asia/Seoul') AS week,
      SUM(amount)::bigint                                     AS total
    FROM invoices
    WHERE
      "academyId" = ${academyId}
      AND status  = 'PAID'
      AND "paidAt" >= ${fromUTC}
      AND "paidAt" <= ${toUTC}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((r) => ({
    date:  r.week.toISOString().slice(0, 10),
    value: Number(r.total),
  }));
}
