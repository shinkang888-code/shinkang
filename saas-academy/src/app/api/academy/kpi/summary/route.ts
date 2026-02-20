/**
 * GET /api/academy/kpi/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns all KPI summary metrics for the selected range.
 *
 * RBAC: ADMIN (own academy) or SUPER_ADMIN (any academy via ?academyId=)
 * TEACHER / STUDENT → 403
 *
 * Response shape:
 * {
 *   range: { from, to },
 *   revenue: { totalPaidAmount, paidCount, outstandingAmount, outstandingCount, failedCount, collectionRate },
 *   students: { activeCount, newCount, churnCount, participantCount },
 *   attendance: { scheduledSessions, completedSessions, attendanceRate, lateRate, activeTeachers },
 *   risk: { atRiskStudentsCount, delinquentStudentsCount },
 *   notifications: { queuedCount, failedCount }
 * }
 */
import { type NextRequest, NextResponse } from "next/server";
import { guardRoute } from "@/lib/guards/route-guard";
import { KpiRangeSchema } from "@/lib/validators/kpi";
import { getRevenueKPI }   from "@/lib/kpi/revenue.queries";
import { getStudentKPI }   from "@/lib/kpi/students.queries";
import { getAttendanceKPI } from "@/lib/kpi/attendance.queries";
import { getRiskKPI, getNotifKPI } from "@/lib/kpi/risk.queries";

export const revalidate = 60; // cache 60s

export async function GET(req: NextRequest) {
  // ── Auth & RBAC ───────────────────────────────────────────────────────────
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.user.role === "TEACHER" || ctx.user.role === "STUDENT") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Access denied" } },
      { status: 403 },
    );
  }

  // ── Resolve academyId ─────────────────────────────────────────────────────
  const academyId =
    ctx.user.role === "SUPER_ADMIN"
      ? req.nextUrl.searchParams.get("academyId")
      : ctx.academyId;

  if (!academyId) {
    return NextResponse.json(
      { error: { code: "ACADEMY_REQUIRED", message: "academyId is required for SUPER_ADMIN" } },
      { status: 400 },
    );
  }

  // ── Parse & validate query params ─────────────────────────────────────────
  const raw = {
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to:   req.nextUrl.searchParams.get("to")   ?? undefined,
  };

  const parsed = KpiRangeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_PARAMS", message: "Invalid query parameters", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { from, to } = parsed.data;

  // ── Fetch all KPIs in parallel ────────────────────────────────────────────
  const [revenue, students, attendance, risk, notifications] = await Promise.all([
    getRevenueKPI(academyId, from, to),
    getStudentKPI(academyId, from, to),
    getAttendanceKPI(academyId, from, to),
    getRiskKPI(academyId),
    getNotifKPI(academyId, from, to),
  ]);

  return NextResponse.json({
    range: { from, to },
    revenue,
    students,
    attendance: {
      scheduledSessions: attendance.scheduledSessions,
      completedSessions: attendance.completedSessions,
      attendanceRate:    attendance.attendanceRate,
      lateRate:          attendance.lateRate,
    },
    teachers: { activeCount: attendance.activeTeachers },
    risk,
    notifications,
  });
}
