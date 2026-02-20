import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

interface Params {
  params: Promise<{ scheduleId: string }>;
}

const updateSchema = z.object({
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "ABSENT"]).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  memo: z.string().optional(),
});

// PATCH /api/admin/schedules/[scheduleId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { scheduleId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  // 권한 확인
  const schedule = await prisma.lessonSchedule.findUnique({
    where: { id: scheduleId },
    include: { lesson: { include: { studio: true } } },
  });
  if (!schedule) return apiError("Schedule not found", 404);
  if (schedule.lesson.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  const updated = await prisma.lessonSchedule.update({
    where: { id: scheduleId },
    data: {
      ...parsed.data,
      ...(parsed.data.startAt && { startAt: new Date(parsed.data.startAt) }),
      ...(parsed.data.endAt && { endAt: new Date(parsed.data.endAt) }),
    },
  });

  return apiSuccess(updated);
}

// DELETE /api/admin/schedules/[scheduleId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { scheduleId } = await params;

  const schedule = await prisma.lessonSchedule.findUnique({
    where: { id: scheduleId },
    include: { lesson: { include: { studio: true } } },
  });
  if (!schedule) return apiError("Schedule not found", 404);
  if (schedule.lesson.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  await prisma.lessonSchedule.delete({ where: { id: scheduleId } });
  return apiSuccess({ message: "Schedule deleted" });
}
