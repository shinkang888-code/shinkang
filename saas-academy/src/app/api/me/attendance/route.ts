/**
 * GET /api/me/attendance
 * Returns attendance history for the authenticated student.
 * Query: classId, month (YYYY-MM), page, limit
 */
import { type NextRequest } from "next/server";
import { guardRoute, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["STUDENT"]);
  if (ctx instanceof Response) return ctx;

  const studentUserId = ctx.user.sub;
  const academyId     = ctx.academyId!;

  const classId = req.nextUrl.searchParams.get("classId") ?? undefined;
  const month   = req.nextUrl.searchParams.get("month")   ?? undefined;
  const page    = Math.max(1, parseInt(req.nextUrl.searchParams.get("page")  ?? "1",  10));
  const limit   = Math.min(200, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10));

  const where: Record<string, unknown> = {
    academyId,
    studentUserId,
    ...(classId ? { classId } : {}),
    ...(month
      ? { session: { localDate: { gte: `${month}-01`, lte: `${month}-31` } } }
      : {}),
  };

  const [records, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: {
        session: { select: { id: true, localDate: true, startsAt: true, endsAt: true, status: true } },
        class:   { select: { id: true, name: true } },
      },
      orderBy: { session: { startsAt: "desc" } },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.attendance.count({ where }),
  ]);

  // Compute summary: total / present / absent / late / excused
  const summary = await prisma.attendance.groupBy({
    by:     ["status"],
    where:  { academyId, studentUserId, ...(classId ? { classId } : {}) },
    _count: { _all: true },
  });

  return ok({ records, total, page, limit, summary });
}
