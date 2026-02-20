import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, verifyStudioAccess, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

const lessonSchema = z.object({
  studioId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  color: z.string().optional(),
  isRecurring: z.boolean().default(true),
});

// GET /api/admin/lessons?studioId=xxx
export async function GET(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const studioId = new URL(req.url).searchParams.get("studioId");
  if (!studioId) return apiError("studioId is required");

  const hasAccess = await verifyStudioAccess(session!.user.id, studioId);
  if (!hasAccess) return apiError("Forbidden", 403);

  const lessons = await prisma.lesson.findMany({
    where: { studioId },
    include: { _count: { select: { schedules: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return apiSuccess(lessons);
}

// POST /api/admin/lessons
export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = lessonSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const hasAccess = await verifyStudioAccess(session!.user.id, parsed.data.studioId);
  if (!hasAccess) return apiError("Forbidden", 403);

  const lesson = await prisma.lesson.create({ data: parsed.data });
  return apiSuccess(lesson, 201);
}
