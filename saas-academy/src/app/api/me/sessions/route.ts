/**
 * GET /api/me/sessions
 * Returns upcoming (and recent) class sessions for the authenticated student.
 * Query: month (YYYY-MM), classId, status
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
  const status  = req.nextUrl.searchParams.get("status")  ?? undefined;

  // Get enrolled class IDs
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      studentUserId,
      academyId,
      status: "ACTIVE",
      ...(classId ? { classId } : {}),
    },
    select: { classId: true },
  });

  if (enrollments.length === 0) return ok([]);

  const enrolledClassIds = enrollments.map((e) => e.classId);

  const where: Record<string, unknown> = {
    academyId,
    classId: { in: enrolledClassIds },
    ...(status ? { status } : {}),
    ...(month
      ? { localDate: { gte: `${month}-01`, lte: `${month}-31` } }
      : {
          // Default: last 4 weeks + next 8 weeks
          startsAt: {
            gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
            lte: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000),
          },
        }),
  };

  const sessions = await prisma.classSession.findMany({
    where,
    include: {
      class:       { select: { id: true, name: true } },
      attendances: {
        where:  { studentUserId },
        select: { status: true, memo: true, markedAt: true },
        take:   1,
      },
    },
    orderBy: { startsAt: "asc" },
    take: 200,
  });

  return ok(
    sessions.map((s) => ({
      ...s,
      myAttendance: s.attendances[0] ?? null,
      attendances: undefined,
    })),
  );
}
