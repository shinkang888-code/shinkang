/**
 * PATCH /api/academy/enrollments/[enrollmentId]
 * Update enrollment status (ACTIVE | PAUSED | DROPPED).
 * Allowed: ADMIN, SUPER_ADMIN
 */
import { type NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { updateEnrollmentSchema } from "@/lib/validators/attendance";

interface Params { params: Promise<{ enrollmentId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { enrollmentId } = await params;
  const academyId = ctx.academyId!;

  const enrollment = await prisma.classEnrollment.findFirst({
    where: { id: enrollmentId, academyId },
  });
  if (!enrollment) return err("Enrollment not found", 404);

  const body = await parseBody(req, updateEnrollmentSchema);
  if (body instanceof Response) return body;

  const updated = await prisma.classEnrollment.update({
    where: { id: enrollmentId },
    data:  { status: body.status },
    include: {
      student: { select: { id: true, name: true, email: true } },
      class:   { select: { id: true, name: true } },
    },
  });

  return ok(updated);
}
