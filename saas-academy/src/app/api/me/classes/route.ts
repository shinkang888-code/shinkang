/**
 * GET /api/me/classes
 * Returns all classes the authenticated student is enrolled in.
 */
import { type NextRequest } from "next/server";
import { guardRoute, ok } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["STUDENT"]);
  if (ctx instanceof Response) return ctx;

  const studentUserId = ctx.user.sub;
  const academyId     = ctx.academyId!;

  const enrollments = await prisma.classEnrollment.findMany({
    where:   { studentUserId, academyId, status: "ACTIVE" },
    include: {
      class: {
        include: {
          schedules: true,
          teacher:   { select: { id: true, name: true } },
          _count:    { select: { sessions: { where: { status: "SCHEDULED" } } } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return ok(enrollments.map((e) => ({ enrollment: e, class: e.class })));
}
