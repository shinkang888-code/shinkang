// POST /api/teacher/practice/review - 연습 게시물 검토 (OK/NG)
import { NextRequest, NextResponse } from "next/server";
import { requireTeacher, getTeacherStudio } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ReviewSchema = z.object({
  postId: z.string(),
  reviewResult: z.enum(["OK", "NG"]),
  reviewComment: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const body = await req.json();
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const studio = await getTeacherStudio(session!.user.id);
  if (!studio) {
    return NextResponse.json({ success: false, error: "소속 학원이 없습니다." }, { status: 403 });
  }

  // Verify post belongs to studio and is SUBMITTED
  const post = await prisma.practicePost.findFirst({
    where: { id: parsed.data.postId, studioId: studio.id },
  });
  if (!post) {
    return NextResponse.json({ success: false, error: "연습 게시물을 찾을 수 없습니다." }, { status: 404 });
  }
  if (post.status !== "SUBMITTED") {
    return NextResponse.json({ success: false, error: "제출된 게시물만 검토할 수 있습니다." }, { status: 400 });
  }

  const updated = await prisma.practicePost.update({
    where: { id: parsed.data.postId },
    data: {
      status: "REVIEWED",
      reviewResult: parsed.data.reviewResult,
      reviewComment: parsed.data.reviewComment,
      reviewedByUserId: session!.user.id,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
