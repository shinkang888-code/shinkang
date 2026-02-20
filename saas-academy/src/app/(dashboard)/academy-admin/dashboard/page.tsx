/**
 * src/app/(dashboard)/academy-admin/dashboard/page.tsx
 *
 * Server component: Owner KPI Dashboard.
 *
 * - ADMIN-only (layout already enforces ADMIN role, but we double-check).
 * - Fetches initial data server-side for the current KST month.
 * - Passes data to DashboardClient for interactive rendering.
 * - Revalidates every 60 seconds (Next.js ISR).
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { currentMonthKST } from "@/lib/kpi/date-utils";
import { getRevenueKPI }    from "@/lib/kpi/revenue.queries";
import { getStudentKPI }    from "@/lib/kpi/students.queries";
import { getAttendanceKPI, getTopTeachersBySessions, getTopTeachersByAttendanceRate } from "@/lib/kpi/attendance.queries";
import { getRiskKPI, getNotifKPI, getAtRiskStudents, getDelinquentStudents } from "@/lib/kpi/risk.queries";
import { getKpiTimeseries } from "@/lib/kpi/timeseries.queries";
import type {
  KpiSummaryResponse,
  KpiTimeseriesResponse,
  KpiToplistsResponse,
} from "@/lib/kpi/types";
import DashboardClient from "./DashboardClient";

export const revalidate = 60; // ISR: re-render at most every 60 seconds

export default async function DashboardPage() {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") redirect("/login");

  const academyId = user.academyId;
  if (!academyId) redirect("/login");

  // ── Default date range: current KST month ─────────────────────────────────
  const { from, to } = currentMonthKST();

  // ── Fetch all KPI data in parallel ─────────────────────────────────────────
  const [
    revenue,
    students,
    attendance,
    risk,
    notifications,
    timeseries,
    topTeachersBySessions,
    topTeachersByAttendanceRate,
    atRiskStudents,
    delinquentStudents,
  ] = await Promise.all([
    getRevenueKPI(academyId, from, to),
    getStudentKPI(academyId, from, to),
    getAttendanceKPI(academyId, from, to),
    getRiskKPI(academyId),
    getNotifKPI(academyId, from, to),
    getKpiTimeseries(academyId, from, to, "day"),
    getTopTeachersBySessions(academyId, from, to, 5),
    getTopTeachersByAttendanceRate(academyId, from, to, 5),
    getAtRiskStudents(academyId, 3),
    getDelinquentStudents(academyId, 7),
  ]);

  // ── Shape into typed response objects ──────────────────────────────────────
  const initialSummary: KpiSummaryResponse = {
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
  };

  const initialTimeseries: KpiTimeseriesResponse = {
    range:  { from, to },
    bucket: "day",
    series: timeseries,
  };

  const initialToplists: KpiToplistsResponse = {
    range: { from, to },
    topTeachersBySessions,
    topTeachersByAttendanceRate,
    atRiskStudents,
    delinquentStudents,
  };

  return (
    <DashboardClient
      initialSummary={initialSummary}
      initialTimeseries={initialTimeseries}
      initialToplists={initialToplists}
    />
  );
}
