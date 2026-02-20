import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

interface Params {
  params: Promise<{ lessonId: string }>;
}

const scheduleSchema = z.object({
  studentId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  memo: z.string().optional(),
});

// GET /api/admin/lessons/[lessonId]/schedules?from=&to= — 레슨별 스케줄
// PATCH /api/admin/lessons/[lessonId] — 레슨 수정
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { lessonId } = await params;
  const body = await req.json();

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { studio: true },
  });
  if (!lesson) return apiError("Lesson not found", 404);
  if (lesson.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: body,
  });

  return apiSuccess(updated);
}

// DELETE /api/admin/lessons/[lessonId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { studio: true },
  });
  if (!lesson) return apiError("Lesson not found", 404);
  if (lesson.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  await prisma.lesson.delete({ where: { id: lessonId } });

  return apiSuccess({ message: "Lesson deleted" });
}
