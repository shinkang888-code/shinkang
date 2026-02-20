import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyStudentAccess, apiSuccess, apiError } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ sessionId: string }>;
}

// PATCH /api/student/practice/[sessionId] — 연습 종료
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { sessionId } = await params;

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
  });
  if (!practiceSession) return apiError("Session not found", 404);
  if (practiceSession.endedAt) return apiError("이미 종료된 세션입니다.", 409);

  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id },
  });
  if (!student) return apiError("Student not found", 404);
  if (practiceSession.studentId !== student.id) return apiError("Forbidden", 403);

  const body = await req.json().catch(() => ({}));
  const endedAt = new Date();
  const durationMin = Math.floor(
    (endedAt.getTime() - practiceSession.startedAt.getTime()) / (1000 * 60)
  );

  const updated = await prisma.practiceSession.update({
    where: { id: sessionId },
    data: {
      endedAt,
      durationMin,
      piece: body.piece ?? practiceSession.piece,
      memo: body.memo ?? practiceSession.memo,
    },
  });

  return apiSuccess(updated);
}

// DELETE /api/student/practice/[sessionId] — 세션 삭제
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { sessionId } = await params;

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
  });
  if (!practiceSession) return apiError("Session not found", 404);

  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id },
  });
  if (!student || practiceSession.studentId !== student.id) return apiError("Forbidden", 403);

  await prisma.practiceSession.delete({ where: { id: sessionId } });
  return apiSuccess({ message: "Session deleted" });
}
