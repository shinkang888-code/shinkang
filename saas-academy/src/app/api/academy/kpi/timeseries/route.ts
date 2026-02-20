/**
 * GET /api/academy/kpi/timeseries?from=YYYY-MM-DD&to=YYYY-MM-DD&bucket=day|week
 *
 * Returns three timeseries for trend charts.
 *
 * Response:
 * {
 *   range: { from, to },
 *   bucket: "day" | "week",
 *   series: {
 *     revenuePaidAmount: [{ date, value }],
 *     attendanceRate:    [{ date, value }],
 *     newStudents:       [{ date, value }]
 *   }
 * }
 *
 * RBAC: ADMIN (own academy) or SUPER_ADMIN
 */
import { type NextRequest, NextResponse } from "next/server";
import { guardRoute }         from "@/lib/guards/route-guard";
import { KpiTimeseriesSchema } from "@/lib/validators/kpi";
import { getKpiTimeseries }   from "@/lib/kpi/timeseries.queries";

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
      { error: { code: "ACADEMY_REQUIRED", message: "academyId is required for SUPER_ADMIN" } },
      { status: 400 },
    );
  }

  // ── Parse params ──────────────────────────────────────────────────────────
  const raw = {
    from:   req.nextUrl.searchParams.get("from")   ?? undefined,
    to:     req.nextUrl.searchParams.get("to")     ?? undefined,
    bucket: req.nextUrl.searchParams.get("bucket") ?? undefined,
  };

  const parsed = KpiTimeseriesSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_PARAMS", message: "Invalid parameters", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { from, to, bucket } = parsed.data;

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const series = await getKpiTimeseries(academyId, from, to, bucket);

  return NextResponse.json({
    range:  { from, to },
    bucket,
    series,
  });
}
