/**
 * POST /api/academy/classes  – create a class + schedules + generate sessions
 * GET  /api/academy/classes  – list classes for the current academy
 *
 * Allowed roles: ADMIN (own academy), SUPER_ADMIN (any), TEACHER (GET only).
 */
import { type NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { createClassSchema } from "@/lib/validators/attendance";
import { generateSessions } from "@/lib/services/classSessionGenerator";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "TEACHER", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const academyId = ctx.academyId!;

  const classes = await prisma.class.findMany({
    where: {
      academyId,
      ...(ctx.user.role === "TEACHER"
        ? { teacherUserId: ctx.user.sub }
        : {}),
    },
    include: {
      teacher:  { select: { id: true, name: true, email: true } },
      schedules: true,
      _count: {
        select: {
          enrollments: { where: { status: "ACTIVE" } },
          sessions:    { where: { status: { not: "CANCELED" } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(classes);
}

export async function POST(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const body = await parseBody(req, createClassSchema);
  if (body instanceof Response) return body;

  const academyId = ctx.academyId!;

  // Verify teacherUserId belongs to same academy (if provided)
  if (body.teacherUserId) {
    const teacher = await prisma.user.findUnique({
      where: { id: body.teacherUserId },
      select: { academyId: true, role: true },
    });
    if (!teacher || teacher.academyId !== academyId) {
      return err("Teacher not found in this academy", 422);
    }
    if (teacher.role !== "TEACHER") {
      return err("User is not a TEACHER", 422);
    }
  }

  const startDate = new Date(body.startDate);
  const endDate   = body.endDate ? new Date(body.endDate) : null;

  // Create class + schedules in a transaction
  const newClass = await prisma.$transaction(async (tx) => {
    const cls = await tx.class.create({
      data: {
        academyId,
        name:          body.name,
        teacherUserId: body.teacherUserId ?? null,
        capacity:      body.capacity ?? null,
        startDate,
        endDate,
        status: "ACTIVE",
      },
    });

    // Create schedule rows
    await tx.classSchedule.createMany({
      data: body.schedules.map((s) => ({
        academyId,
        classId:     cls.id,
        daysOfWeek:  s.daysOfWeek,
        startTime:   s.startTime,
        durationMin: s.durationMin,
        timezone:    s.timezone ?? "Asia/Seoul",
      })),
    });

    return cls;
  });

  // Generate sessions (outside transaction – may be many rows)
  const dateTo = new Date();
  dateTo.setDate(dateTo.getDate() + body.generateWeeks * 7);
  const generated = await generateSessions({
    classId:   newClass.id,
    academyId,
    dateFrom:  startDate,
    dateTo:    endDate && endDate < dateTo ? endDate : dateTo,
  });

  const result = await prisma.class.findUnique({
    where:   { id: newClass.id },
    include: { schedules: true, _count: { select: { sessions: true } } },
  });

  return ok({ class: result, sessionsGenerated: generated }, 201);
}
