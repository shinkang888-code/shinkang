import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";

// GET /api/student/schedule?from=2024-01-01&to=2024-01-31
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id },
  });
  if (!student) return apiError("Student not found", 404);

  const schedules = await prisma.lessonSchedule.findMany({
    where: {
      studentId: student.id,
      ...(from && to && {
        startAt: { gte: new Date(from), lte: new Date(to) },
      }),
    },
    include: {
      lesson: { select: { id: true, title: true, color: true, description: true } },
    },
    orderBy: { startAt: "asc" },
  });

  // FullCalendar 이벤트 형식
  const events = schedules.map((s) => ({
    id: s.id,
    title: s.lesson.title,
    start: s.startAt,
    end: s.endAt,
    backgroundColor: s.lesson.color ?? "#4F46E5",
    extendedProps: {
      lessonId: s.lessonId,
      status: s.status,
      memo: s.memo,
      description: s.lesson.description,
    },
  }));

  return apiSuccess(events);
}
