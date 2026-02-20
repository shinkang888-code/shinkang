/**
 * GET /api/academy/kpi/toplists?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns ranked lists for teacher leaderboards and risk tables.
 *
 * Response:
 * {
 *   range: { from, to },
 *   topTeachersBySessions:       [{ teacherId, teacherName, sessions }],
 *   topTeachersByAttendanceRate: [{ teacherId, teacherName, attendanceRate, totalSessions }],
 *   atRiskStudents:              [{ studentId, name, absentCount30d, lastSessionDate }],
 *   delinquentStudents:          [{ studentId, name, overdueAmount, overdueDaysMax }]
 * }
 *
 * Note: atRiskStudents and delinquentStudents are ALWAYS rolling (not range-dependent).
 * RBAC: ADMIN or SUPER_ADMIN
 */
import { type NextRequest, NextResponse } from "next/server";
import { guardRoute }        from "@/lib/guards/route-guard";
import { KpiRangeSchema }    from "@/lib/validators/kpi";
import {
  getTopTeachersBySessions,
  getTopTeachersByAttendanceRate,
} from "@/lib/kpi/attendance.queries";
import {
  getAtRiskStudents,
  getDelinquentStudents,
} from "@/lib/kpi/risk.queries";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.user.role === "TEACHER" || ctx.user.role === "STUDENT") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Access denied" } },
      { status: 403 },
    );
  }

  const academyId =
    ctx.user.role === "SUPER_ADMIN"
      ? req.nextUrl.searchParams.get("academyId")
      : ctx.academyId;

  if (!academyId) {
    return NextResponse.json(
      { error: { code: "ACADEMY_REQUIRED", message: "academyId required" } },
      { status: 400 },
    );
  }

  // ── Parse params ──────────────────────────────────────────────────────────
  const raw = {
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to:   req.nextUrl.searchParams.get("to")   ?? undefined,
  };

  const parsed = KpiRangeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_PARAMS", message: "Invalid parameters", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { from, to } = parsed.data;

  // ── Fetch all lists in parallel ───────────────────────────────────────────
  const [
    topTeachersBySessions,
    topTeachersByAttendanceRate,
    atRiskStudents,
    delinquentStudents,
  ] = await Promise.all([
    getTopTeachersBySessions(academyId, from, to, 5),
    getTopTeachersByAttendanceRate(academyId, from, to, 5),
    getAtRiskStudents(academyId, 3),
    getDelinquentStudents(academyId, 7),
  ]);

  return NextResponse.json({
    range: { from, to },
    topTeachersBySessions,
    topTeachersByAttendanceRate,
    atRiskStudents,
    delinquentStudents,
  });
}
