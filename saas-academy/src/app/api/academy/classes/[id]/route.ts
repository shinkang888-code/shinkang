/**
 * GET    /api/academy/classes/[id]   – get a single class (with sessions + enrollments summary)
 * PATCH  /api/academy/classes/[id]   – update class fields
 */
import { type NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { updateClassSchema } from "@/lib/validators/attendance";

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "TEACHER", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const academyId = ctx.academyId!;

  const cls = await prisma.class.findFirst({
    where: { id, academyId },
    include: {
      teacher:     { select: { id: true, name: true, email: true } },
      schedules:   true,
      enrollments: {
        include: { student: { select: { id: true, name: true, email: true } } },
        orderBy: { enrolledAt: "asc" },
      },
      _count: {
        select: {
          sessions:    true,
          attendances: true,
        },
      },
    },
  });

  if (!cls) return err("Class not found", 404);

  // TEACHER can only see their own class
  if (ctx.user.role === "TEACHER" && cls.teacherUserId !== ctx.user.sub) {
    return err("Forbidden", 403);
  }

  return ok(cls);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const academyId = ctx.academyId!;

  const cls = await prisma.class.findFirst({ where: { id, academyId } });
  if (!cls) return err("Class not found", 404);

  const body = await parseBody(req, updateClassSchema);
  if (body instanceof Response) return body;

  // Verify teacherUserId if changing
  if (body.teacherUserId) {
    const teacher = await prisma.user.findUnique({
      where:  { id: body.teacherUserId },
      select: { academyId: true, role: true },
    });
    if (!teacher || teacher.academyId !== academyId) {
      return err("Teacher not found in this academy", 422);
    }
    if (teacher.role !== "TEACHER") {
      return err("User is not a TEACHER", 422);
    }
  }

  const updated = await prisma.class.update({
    where: { id },
    data: {
      ...(body.name          !== undefined ? { name:          body.name }          : {}),
      ...(body.teacherUserId !== undefined ? { teacherUserId: body.teacherUserId } : {}),
      ...(body.capacity      !== undefined ? { capacity:      body.capacity }      : {}),
      ...(body.endDate       !== undefined ? { endDate:       body.endDate ? new Date(body.endDate) : null } : {}),
      ...(body.status        !== undefined ? { status:        body.status }        : {}),
    },
    include: { schedules: true },
  });

  return ok(updated);
}
