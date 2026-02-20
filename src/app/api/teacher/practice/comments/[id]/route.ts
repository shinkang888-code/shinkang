// PATCH /api/teacher/practice/comments/[id] - 핀 토글
import { NextRequest, NextResponse } from "next/server";
import { requireTeacher, getTeacherStudio } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PinToggleSchema = z.object({
  pinned: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = PinToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
  }

  const studio = await getTeacherStudio(session!.user.id);
  if (!studio) {
    return NextResponse.json({ success: false, error: "소속 학원이 없습니다." }, { status: 403 });
  }

  const comment = await prisma.practiceComment.findFirst({
    where: { id, studioId: studio.id },
  });
  if (!comment) {
    return NextResponse.json({ success: false, error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  const updated = await prisma.practiceComment.update({
    where: { id },
    data: { pinned: parsed.data.pinned },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const { id } = await params;

  const studio = await getTeacherStudio(session!.user.id);
  if (!studio) {
    return NextResponse.json({ success: false, error: "소속 학원이 없습니다." }, { status: 403 });
  }

  const comment = await prisma.practiceComment.findFirst({
    where: { id, studioId: studio.id, authorUserId: session!.user.id },
  });
  if (!comment) {
    return NextResponse.json({ success: false, error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.practiceComment.delete({ where: { id } });

  return NextResponse.json({ success: true, data: { deleted: true } });
}
