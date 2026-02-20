/**
 * GET /api/student/practice/goal?weekStart=YYYY-MM-DD
 * Returns goal + actual count for the week starting on weekStart (Monday).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { GetGoalSchema } from "@/lib/schemas/practice";

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = GetGoalSchema.safeParse({ weekStart: searchParams.get("weekStart") });
  if (!parsed.success) return apiError("Invalid parameters", 400, parsed.error.flatten());

  const { weekStart } = parsed.data;

  // Get student
  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id, isActive: true },
    select: { id: true, studioId: true },
  });
  if (!student) return apiError("Student not found", 404);

  // Calculate week end (Sunday = weekStart + 6 days)
  const weekStartDate = new Date(weekStart + "T00:00:00Z");
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);

  // Get goal settings (student-specific, else studio default)
  const [studentGoal, studioGoal] = await Promise.all([
    prisma.practiceGoalSetting.findFirst({
      where: { studioId: student.studioId, studentId: student.id },
    }),
    prisma.practiceGoalSetting.findFirst({
      where: { studioId: student.studioId, studentId: null },
    }),
  ]);

  const goal = studentGoal ?? studioGoal;
  const weekTargetCount = goal?.weekTargetCount ?? 3;
  const basis = goal?.basis ?? "SUBMISSION";

  // Count actual submissions in the week
  const actualCount = await prisma.practicePost.count({
    where: {
      studentId: student.id,
      studioId: student.studioId,
      status: basis === "SUBMISSION" ? "SUBMITTED" : undefined,
      thread: {
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    },
  });

  return apiSuccess({
    weekStart,
    weekEnd,
    weekTargetCount,
    actualCount,
    basis,
    achieved: actualCount >= weekTargetCount,
  });
}
