import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

const startSchema = z.object({
  piece: z.string().optional(),
  memo: z.string().optional(),
});

// GET /api/student/practice — 연습 기록 조회
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id },
  });
  if (!student) return apiError("Student not found", 404);

  const sessions = await prisma.practiceSession.findMany({
    where: { studentId: student.id },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  // 현재 진행 중인 세션
  const activeSession = sessions.find((s) => !s.endedAt) ?? null;

  return apiSuccess({ sessions, activeSession });
}

// POST /api/student/practice — 연습 시작
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = startSchema.safeParse(body);

  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id },
  });
  if (!student) return apiError("Student not found", 404);

  // 이미 진행 중인 세션 확인
  const activeSession = await prisma.practiceSession.findFirst({
    where: { studentId: student.id, endedAt: null },
  });
  if (activeSession) return apiError("이미 진행 중인 연습 세션이 있습니다.", 409);

  const practiceSession = await prisma.practiceSession.create({
    data: {
      studentId: student.id,
      startedAt: new Date(),
      piece: parsed.success ? parsed.data.piece : undefined,
      memo: parsed.success ? parsed.data.memo : undefined,
    },
  });

  return apiSuccess(practiceSession, 201);
}
