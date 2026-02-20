// POST /api/teacher/practice/comments - 선생님 댓글 작성
// PATCH /api/teacher/practice/comments/[id] - 핀 토글
import { NextRequest, NextResponse } from "next/server";
import { requireTeacher, getTeacherStudio } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateCommentSchema = z.object({
  threadId: z.string(),
  postId: z.string().optional(),
  body: z.string().min(1).max(2000),
  type: z.enum(["GENERAL", "INSTRUCTION", "QUESTION", "ANSWER"]).default("GENERAL"),
  parentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const body = await req.json();
  const parsed = CreateCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const studio = await getTeacherStudio(session!.user.id);
  if (!studio) {
    return NextResponse.json({ success: false, error: "소속 학원이 없습니다." }, { status: 403 });
  }

  // Verify thread belongs to studio
  const thread = await prisma.practiceThread.findFirst({
    where: { id: parsed.data.threadId, studioId: studio.id },
  });
  if (!thread) {
    return NextResponse.json({ success: false, error: "연습 스레드를 찾을 수 없습니다." }, { status: 404 });
  }

  const comment = await prisma.practiceComment.create({
    data: {
      studioId: studio.id,
      threadId: parsed.data.threadId,
      postId: parsed.data.postId,
      authorUserId: session!.user.id,
      authorRole: "TEACHER",
      body: parsed.data.body,
      type: parsed.data.type,
      parentId: parsed.data.parentId,
    },
    include: {
      author: { select: { id: true, name: true, profileImage: true } },
    },
  });

  return NextResponse.json({ success: true, data: comment }, { status: 201 });
}
