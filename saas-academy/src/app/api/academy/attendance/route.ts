/**
 * GET /api/academy/attendance
 * List attendance records with filters.
 * Query: classId, sessionId, studentUserId, month (YYYY-MM), page, limit
 * Allowed: ADMIN, TEACHER (own classes only), SUPER_ADMIN
 */
import { type NextRequest } from "next/server";
import { guardRoute, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { listAttendanceQuerySchema } from "@/lib/validators/attendance";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "TEACHER", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const academyId = ctx.academyId!;

  const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = listAttendanceQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return err("Invalid query params", 422, parsed.error.flatten());
  }
  const q = parsed.data;

  // TEACHER: only own classes
  const teacherClassFilter =
    ctx.user.role === "TEACHER"
      ? { class: { teacherUserId: ctx.user.sub } }
      : {};

  const where: Record<string, unknown> = {
    academyId,
    ...teacherClassFilter,
    ...(q.classId       ? { classId:       q.classId }       : {}),
    ...(q.sessionId     ? { sessionId:     q.sessionId }     : {}),
    ...(q.studentUserId ? { studentUserId: q.studentUserId } : {}),
    ...(q.month
      ? { session: { localDate: { gte: `${q.month}-01`, lte: `${q.month}-31` } } }
      : {}),
  };

  const [records, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: {
        student:  { select: { id: true, name: true, email: true } },
        session:  { select: { id: true, localDate: true, startsAt: true } },
        class:    { select: { id: true, name: true } },
        markedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ session: { startsAt: "desc" } }],
      skip:    (q.page - 1) * q.limit,
      take:    q.limit,
    }),
    prisma.attendance.count({ where }),
  ]);

  return ok({ records, total, page: q.page, limit: q.limit });
}
