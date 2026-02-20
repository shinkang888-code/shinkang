/**
 * GET   /api/academy/sessions       – list sessions (with filters)
 * PATCH /api/academy/sessions/[id]  – handled in [sessionId]/route.ts
 *
 * Query params: classId, month (YYYY-MM), localDate, status, page, limit
 * Allowed: ADMIN, TEACHER, SUPER_ADMIN
 */
import { type NextRequest } from "next/server";
import { guardRoute, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { listSessionsQuerySchema } from "@/lib/validators/attendance";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "TEACHER", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const academyId = ctx.academyId!;

  // Parse query params
  const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = listSessionsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return err("Invalid query params", 422, parsed.error.flatten());
  }
  const q = parsed.data;

  // For TEACHER role, only show sessions for their classes
  const teacherFilter =
    ctx.user.role === "TEACHER"
      ? { class: { teacherUserId: ctx.user.sub } }
      : {};

  const where: Record<string, unknown> = {
    academyId,
    ...teacherFilter,
    ...(q.classId    ? { classId:   q.classId }   : {}),
    ...(q.status     ? { status:    q.status }     : {}),
    ...(q.localDate  ? { localDate: q.localDate }  : {}),
    ...(q.month
      ? {
          localDate: {
            gte: `${q.month}-01`,
            lte: `${q.month}-31`,
          },
        }
      : {}),
  };

  const [sessions, total] = await Promise.all([
    prisma.classSession.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, teacherUserId: true } },
        _count: { select: { attendances: true } },
      },
      orderBy: { startsAt: "asc" },
      skip:    (q.page - 1) * q.limit,
      take:    q.limit,
    }),
    prisma.classSession.count({ where }),
  ]);

  return ok({ sessions, total, page: q.page, limit: q.limit });
}
