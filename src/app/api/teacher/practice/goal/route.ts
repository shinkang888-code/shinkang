// GET /api/teacher/practice/goal?studentId=&weekStart=
// PATCH /api/teacher/practice/goal
import { NextRequest, NextResponse } from "next/server";
import { requireTeacher, getTeacherStudio } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const DEFAULT_GOAL = { weekTargetCount: 3, basis: "SUBMISSION" };

export async function GET(req: NextRequest) {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const studentId = req.nextUrl.searchParams.get("studentId");

  const studio = await getTeacherStudio(session!.user.id);
  if (!studio) {
    return NextResponse.json({ success: false, error: "소속 학원이 없습니다." }, { status: 403 });
  }

  const weekStart = req.nextUrl.searchParams.get("weekStart");

  let submittedCount = 0;
  if (weekStart && studentId) {
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 7);

    submittedCount = await prisma.practicePost.count({
      where: {
        studioId: studio.id,
        studentId,
        status: { in: ["SUBMITTED", "REVIEWED"] },
        createdAt: { gte: weekStartDate, lt: weekEndDate },
      },
    });
  }

  const goal = await prisma.practiceGoalSetting.findFirst({
    where: {
      studioId: studio.id,
      OR: [
        { studentId: studentId ?? null },
        { studentId: null },
      ],
    },
    orderBy: { studentId: "desc" }, // student-specific first
  });

  return NextResponse.json({
    success: true,
    data: {
      ...(goal ?? DEFAULT_GOAL),
      submittedCount,
    },
  });
}

const UpsertGoalSchema = z.object({
  studentId: z.string().optional(),
  weekTargetCount: z.number().int().min(1).max(30),
  basis: z.enum(["SUBMISSION", "POST"]).default("SUBMISSION"),
});

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const studio = await getTeacherStudio(session!.user.id);
  if (!studio) {
    return NextResponse.json({ success: false, error: "소속 학원이 없습니다." }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpsertGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const studentIdForGoal = parsed.data.studentId ?? null;

  const goal = await prisma.practiceGoalSetting.upsert({
    where: {
      studioId_studentId: {
        studioId: studio.id,
        studentId: studentIdForGoal as string,
      },
    },
    create: {
      studioId: studio.id,
      studentId: studentIdForGoal,
      weekTargetCount: parsed.data.weekTargetCount,
      basis: parsed.data.basis,
    },
    update: {
      weekTargetCount: parsed.data.weekTargetCount,
      basis: parsed.data.basis,
    },
  });

  return NextResponse.json({ success: true, data: goal });
}
