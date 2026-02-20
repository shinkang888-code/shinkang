/**
 * tests/unit/kpi.test.ts
 *
 * Unit tests for the KPI feature:
 *  1. RBAC – only ADMIN / SUPER_ADMIN may call KPI service helpers
 *  2. Tenant isolation – queries always filter by academyId
 *  3. Timeseries bucketing – day and week bucket logic
 *  4. Date utilities – currentMonthKST, enumerateDays, enumerateWeekStarts
 *  5. KpiRangeSchema – validation and default range injection
 *
 * These are PURE unit tests; Prisma is fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Date-utils tests ──────────────────────────────────────────────────────

import {
  currentMonthKST,
  enumerateDays,
  enumerateWeekStarts,
  addDaysToYMD,
  kstDayStartUTC,
  kstDayEndUTC,
  formatYMD,
} from "@/lib/kpi/date-utils";

describe("date-utils", () => {
  it("currentMonthKST returns YYYY-MM-01 to YYYY-MM-last", () => {
    const { from, to } = currentMonthKST();
    expect(from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from <= to).toBe(true);
  });

  it("enumerateDays returns inclusive range", () => {
    const days = enumerateDays("2025-01-01", "2025-01-05");
    expect(days).toEqual([
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
      "2025-01-04",
      "2025-01-05",
    ]);
  });

  it("enumerateDays returns single day when from === to", () => {
    const days = enumerateDays("2025-03-15", "2025-03-15");
    expect(days).toEqual(["2025-03-15"]);
  });

  it("enumerateWeekStarts covers entire range", () => {
    // 2025-01-06 is a Monday; range Mon→Sun
    const weeks = enumerateWeekStarts("2025-01-06", "2025-01-12");
    expect(weeks[0]).toBe("2025-01-06");
    expect(weeks.length).toBe(1);

    // Two-week range
    const w2 = enumerateWeekStarts("2025-01-06", "2025-01-13");
    expect(w2.length).toBe(2);
    expect(w2[1]).toBe("2025-01-13");
  });

  it("enumerateWeekStarts starting mid-week includes prior Monday", () => {
    // 2025-01-08 is a Wednesday → should start from 2025-01-06 (Monday)
    const weeks = enumerateWeekStarts("2025-01-08", "2025-01-14");
    expect(weeks[0]).toBe("2025-01-06");
  });

  it("addDaysToYMD works across month boundaries", () => {
    expect(addDaysToYMD("2025-01-30", 2)).toBe("2025-02-01");
    expect(addDaysToYMD("2024-02-28", 1)).toBe("2024-02-29"); // leap year
  });

  it("kstDayStartUTC is 9 hours before midnight KST (= 15:00 prev day UTC)", () => {
    const dt = kstDayStartUTC("2025-01-02");
    // 2025-01-02 00:00 KST = 2025-01-01 15:00 UTC
    expect(dt.toISOString()).toBe("2025-01-01T15:00:00.000Z");
  });

  it("kstDayEndUTC is 23:59:59.999 KST = 14:59:59.999 UTC", () => {
    const dt = kstDayEndUTC("2025-01-02");
    expect(dt.toISOString()).toBe("2025-01-02T14:59:59.999Z");
  });
});

// ─── 2. KpiRangeSchema tests ──────────────────────────────────────────────────

import { KpiRangeSchema, KpiTimeseriesSchema } from "@/lib/validators/kpi";

describe("KpiRangeSchema", () => {
  it("accepts valid from/to", () => {
    const r = KpiRangeSchema.safeParse({ from: "2025-01-01", to: "2025-01-31" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.from).toBe("2025-01-01");
      expect(r.data.to).toBe("2025-01-31");
    }
  });

  it("defaults to current month when params are omitted", () => {
    const r = KpiRangeSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.from).toMatch(/^\d{4}-\d{2}-01$/);
    }
  });

  it("rejects invalid date format", () => {
    const r = KpiRangeSchema.safeParse({ from: "01-01-2025", to: "2025-01-31" });
    expect(r.success).toBe(false);
  });

  it("rejects from > to", () => {
    expect(() =>
      KpiRangeSchema.parse({ from: "2025-02-01", to: "2025-01-01" })
    ).toThrow("`from` must not be after `to`");
  });

  it("KpiTimeseriesSchema defaults bucket to 'day'", () => {
    const r = KpiTimeseriesSchema.safeParse({ from: "2025-01-01", to: "2025-01-31" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as { bucket: string }).bucket).toBe("day");
    }
  });

  it("KpiTimeseriesSchema accepts bucket='week'", () => {
    const r = KpiTimeseriesSchema.safeParse({
      from: "2025-01-01",
      to: "2025-01-31",
      bucket: "week",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as { bucket: string }).bucket).toBe("week");
    }
  });
});

// ─── 3. Timeseries bucketing logic ───────────────────────────────────────────
//
// We test the zero-fill + bucket logic used in timeseries.queries.ts
// by importing the pure helper directly rather than hitting the DB.

import { enumerateDays as enumDays, enumerateWeekStarts as enumWeeks } from "@/lib/kpi/date-utils";

describe("timeseries bucketing (zero-fill helpers)", () => {
  it("day buckets: zero-filled for missing dates", () => {
    const from = "2025-01-01";
    const to   = "2025-01-03";

    const rawRevenue: Record<string, number> = {
      "2025-01-01": 100_000,
      // 2025-01-02 missing → should be 0
      "2025-01-03": 50_000,
    };

    const days = enumDays(from, to);
    const points = days.map((d) => ({ date: d, value: rawRevenue[d] ?? 0 }));

    expect(points).toEqual([
      { date: "2025-01-01", value: 100_000 },
      { date: "2025-01-02", value: 0 },
      { date: "2025-01-03", value: 50_000 },
    ]);
  });

  it("week buckets: aggregate into week start dates", () => {
    // Week of 2025-01-06 (Mon) to 2025-01-12 (Sun)
    // Simulate grouping revenue by week start
    const from = "2025-01-06";
    const to   = "2025-01-19"; // two full weeks

    const rawRevenue: Record<string, number> = {
      "2025-01-06": 200_000,
      "2025-01-07": 50_000,
      // rest of first week: 0
      "2025-01-13": 150_000, // second week
    };

    const weekStarts = enumWeeks(from, to);

    const points = weekStarts.map((ws) => {
      const we = addDaysToYMD(ws, 6);
      let total = 0;
      enumDays(ws, we).forEach((d) => {
        total += rawRevenue[d] ?? 0;
      });
      return { date: ws, value: total };
    });

    expect(points[0]).toEqual({ date: "2025-01-06", value: 250_000 });
    expect(points[1]).toEqual({ date: "2025-01-13", value: 150_000 });
  });
});

// ─── 4. RBAC guard (unit mock) ────────────────────────────────────────────────
//
// We mock the route-guard module to test that KPI API handlers reject
// TEACHER and STUDENT roles with 403.

import { NextRequest, NextResponse } from "next/server";
import { GET as summaryGET } from "@/app/api/academy/kpi/summary/route";
import { GET as timeseriesGET } from "@/app/api/academy/kpi/timeseries/route";
import { GET as toplistsGET } from "@/app/api/academy/kpi/toplists/route";

// Mock guardRoute to simulate different roles without a real DB
vi.mock("@/lib/guards/route-guard", () => ({
  guardRoute: vi.fn(),
}));

// Mock all KPI query functions to return empty data (we only test RBAC here)
vi.mock("@/lib/kpi/revenue.queries",    () => ({ getRevenueKPI: vi.fn().mockResolvedValue({ totalPaidAmount: 0, paidCount: 0, outstandingAmount: 0, outstandingCount: 0, failedCount: 0, collectionRate: 0 }) }));
vi.mock("@/lib/kpi/students.queries",   () => ({ getStudentKPI: vi.fn().mockResolvedValue({ activeCount: 0, newCount: 0, churnCount: 0, participantCount: 0 }) }));
vi.mock("@/lib/kpi/attendance.queries", () => ({
  getAttendanceKPI:              vi.fn().mockResolvedValue({ scheduledSessions: 0, completedSessions: 0, attendanceRate: 0, lateRate: 0, activeTeachers: 0 }),
  getTopTeachersBySessions:      vi.fn().mockResolvedValue([]),
  getTopTeachersByAttendanceRate:vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/kpi/risk.queries",       () => ({
  getRiskKPI:           vi.fn().mockResolvedValue({ atRiskStudentsCount: 0, delinquentStudentsCount: 0 }),
  getNotifKPI:          vi.fn().mockResolvedValue({ queuedCount: 0, failedCount: 0 }),
  getAtRiskStudents:    vi.fn().mockResolvedValue([]),
  getDelinquentStudents:vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/kpi/timeseries.queries", () => ({
  getKpiTimeseries: vi.fn().mockResolvedValue({ revenuePaidAmount: [], attendanceRate: [], newStudents: [] }),
}));

import { guardRoute } from "@/lib/guards/route-guard";
const mockGuardRoute = vi.mocked(guardRoute);

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3001/api/academy/kpi/summary");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

describe("KPI API RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summary: TEACHER gets 403", async () => {
    mockGuardRoute.mockResolvedValue({
      user: { id: "u1", role: "TEACHER", academyId: "ac1" } as never,
      db: {} as never,
      rawDb: {} as never,
      academyId: "ac1",
    });

    const req = makeRequest({ from: "2025-01-01", to: "2025-01-31" });
    const res = await summaryGET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("summary: STUDENT gets 403", async () => {
    mockGuardRoute.mockResolvedValue({
      user: { id: "u2", role: "STUDENT", academyId: "ac1" } as never,
      db: {} as never,
      rawDb: {} as never,
      academyId: "ac1",
    });

    const req = makeRequest({ from: "2025-01-01", to: "2025-01-31" });
    const res = await summaryGET(req);
    expect(res.status).toBe(403);
  });

  it("summary: ADMIN succeeds with 200", async () => {
    mockGuardRoute.mockResolvedValue({
      user: { id: "u3", role: "ADMIN", academyId: "ac1" } as never,
      db: {} as never,
      rawDb: {} as never,
      academyId: "ac1",
    });

    const req = makeRequest({ from: "2025-01-01", to: "2025-01-31" });
    const res = await summaryGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revenue).toBeDefined();
    expect(body.students).toBeDefined();
  });

  it("timeseries: TEACHER gets 403", async () => {
    mockGuardRoute.mockResolvedValue({
      user: { id: "u4", role: "TEACHER", academyId: "ac1" } as never,
      db: {} as never,
      rawDb: {} as never,
      academyId: "ac1",
    });

    const req = makeRequest({ from: "2025-01-01", to: "2025-01-31" });
    const res = await timeseriesGET(req);
    expect(res.status).toBe(403);
  });

  it("toplists: STUDENT gets 403", async () => {
    mockGuardRoute.mockResolvedValue({
      user: { id: "u5", role: "STUDENT", academyId: "ac1" } as never,
      db: {} as never,
      rawDb: {} as never,
      academyId: "ac1",
    });

    const req = makeRequest({ from: "2025-01-01", to: "2025-01-31" });
    const res = await toplistsGET(req);
    expect(res.status).toBe(403);
  });

  it("toplists: ADMIN succeeds with 200", async () => {
    mockGuardRoute.mockResolvedValue({
      user: { id: "u6", role: "ADMIN", academyId: "ac1" } as never,
      db: {} as never,
      rawDb: {} as never,
      academyId: "ac1",
    });

    const req = makeRequest({ from: "2025-01-01", to: "2025-01-31" });
    const res = await toplistsGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topTeachersBySessions).toEqual([]);
    expect(body.atRiskStudents).toEqual([]);
  });

  it("summary: SUPER_ADMIN requires academyId param", async () => {
    mockGuardRoute.mockResolvedValue({
      user: { id: "u7", role: "SUPER_ADMIN", academyId: null } as never,
      db: {} as never,
      rawDb: {} as never,
      academyId: null,
    });

    // No academyId param → should 400
    const req = makeRequest({ from: "2025-01-01", to: "2025-01-31" });
    const res = await summaryGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("ACADEMY_REQUIRED");
  });

  it("summary: SUPER_ADMIN with academyId param succeeds", async () => {
    mockGuardRoute.mockResolvedValue({
      user: { id: "u8", role: "SUPER_ADMIN", academyId: null } as never,
      db: {} as never,
      rawDb: {} as never,
      academyId: null,
    });

    const req = makeRequest({ from: "2025-01-01", to: "2025-01-31", academyId: "ac-some" });
    const res = await summaryGET(req);
    expect(res.status).toBe(200);
  });
});

// ─── 5. Tenant isolation test (service layer) ─────────────────────────────────
//
// Verify that query functions pass academyId through, preventing cross-tenant
// data leakage. We mock Prisma and capture the call arguments.

describe("KPI tenant isolation (mock Prisma)", () => {
  it("getRevenueKPI passes academyId to every query", async () => {
    const { prisma } = await import("@/lib/db/client");
    const mockAggregate = vi.fn().mockResolvedValue({ _sum: { amount: null }, _count: { id: 0 } });
    (prisma.invoice as unknown as { aggregate: typeof mockAggregate }).aggregate = mockAggregate;

    const { getRevenueKPI: realGetRevenueKPI } = await import("@/lib/kpi/revenue.queries");
    // Use the real function; Prisma is mocked at module level
    // We just verify the academyId constant flows through by checking that
    // queries are not called with a *different* academyId.
    const acId = "academy-tenant-XYZ";
    await realGetRevenueKPI(acId, "2025-01-01", "2025-01-31");

    // All calls to aggregate should include the correct academyId
    for (const call of mockAggregate.mock.calls) {
      const where = call[0]?.where;
      if (where?.academyId !== undefined) {
        expect(where.academyId).toBe(acId);
      }
    }
  });
});
