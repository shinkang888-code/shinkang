/**
 * POST /api/academy/classes/[id]/enroll
 * Enroll a student in a class.
 * Allowed: ADMIN, SUPER_ADMIN
 */
import { type NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { enrollStudentSchema } from "@/lib/validators/attendance";

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id: classId } = await params;
  const academyId = ctx.academyId!;

  // Verify class exists in this academy
  const cls = await prisma.class.findFirst({ where: { id: classId, academyId } });
  if (!cls) return err("Class not found", 404);
  if (cls.status === "ARCHIVED") return err("Cannot enroll in an archived class", 400);

  const body = await parseBody(req, enrollStudentSchema);
  if (body instanceof Response) return body;

  // Verify student is in same academy
  const student = await prisma.user.findUnique({
    where:  { id: body.studentUserId },
    select: { academyId: true, role: true },
  });
  if (!student || student.academyId !== academyId) {
    return err("Student not found in this academy", 422);
  }
  if (student.role !== "STUDENT") {
    return err("User is not a STUDENT", 422);
  }

  // Check capacity
  if (cls.capacity !== null) {
    const activeCount = await prisma.classEnrollment.count({
      where: { classId, academyId, status: "ACTIVE" },
    });
    if (activeCount >= cls.capacity) {
      return err("Class is at full capacity", 400);
    }
  }

  // Upsert enrollment (re-activate if DROPPED/PAUSED)
  const enrollment = await prisma.classEnrollment.upsert({
    where: {
      academyId_classId_studentUserId: {
        academyId,
        classId,
        studentUserId: body.studentUserId,
      },
    },
    update: { status: "ACTIVE" },
    create: {
      academyId,
      classId,
      studentUserId: body.studentUserId,
      status:        "ACTIVE",
    },
    include: { student: { select: { id: true, name: true, email: true } } },
  });

  return ok(enrollment, 201);
}
