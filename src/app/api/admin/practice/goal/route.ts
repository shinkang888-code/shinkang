/**
 * GET  /api/admin/practice/goal?studioId=...&studentId=...
 * PATCH /api/admin/practice/goal — upsert goal setting
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { UpsertGoalSchema } from "@/lib/schemas/practice";

export async function GET(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const studioId = searchParams.get("studioId");
  const studentId = searchParams.get("studentId") ?? null;

  if (!studioId) return apiError("studioId required", 400);

  // Verify admin owns studio
  const studio = await prisma.studio.findFirst({
    where: { id: studioId, adminId: session!.user.id },
  });
  if (!studio) return apiError("Forbidden", 403);

  const goal = await prisma.practiceGoalSetting.findFirst({
    where: {
      studioId,
      studentId: studentId,
    },
  });

  return apiSuccess({ goal: goal ?? { weekTargetCount: 3, basis: "SUBMISSION" } });
}

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = UpsertGoalSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { studioId, studentId, weekTargetCount, basis } = parsed.data;

  // Verify admin owns studio
  const studio = await prisma.studio.findFirst({
    where: { id: studioId, adminId: session!.user.id },
  });
  if (!studio) return apiError("Forbidden", 403);

  // Prisma doesn't support upsert on nullable unique fields easily
  // Use findFirst + create/update pattern instead
  const sid = studentId ?? null;

  const existing = await prisma.practiceGoalSetting.findFirst({
    where: { studioId, studentId: sid },
  });

  let goal;
  if (existing) {
    goal = await prisma.practiceGoalSetting.update({
      where: { id: existing.id },
      data: { weekTargetCount, basis },
    });
  } else {
    goal = await prisma.practiceGoalSetting.create({
      data: {
        studioId,
        studentId: sid,
        weekTargetCount,
        basis,
      },
    });
  }

  return apiSuccess(goal);
}
