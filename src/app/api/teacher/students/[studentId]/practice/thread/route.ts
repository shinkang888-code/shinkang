// GET /api/teacher/students/[studentId]/practice/thread?date=YYYY-MM-DD
import { NextRequest, NextResponse } from "next/server";
import { requireTeacher, getTeacherStudio } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const { studentId } = await params;
  const dateStr = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const studio = await getTeacherStudio(session!.user.id);
  if (!studio) {
    return NextResponse.json({ success: false, error: "소속 학원이 없습니다." }, { status: 403 });
  }

  // 학생이 해당 스튜디오 소속인지 확인
  const student = await prisma.student.findFirst({
    where: { id: studentId, studioId: studio.id, isActive: true },
    include: { user: { select: { id: true, name: true, email: true, profileImage: true } } },
  });
  if (!student) {
    return NextResponse.json({ success: false, error: "학생을 찾을 수 없습니다." }, { status: 404 });
  }

  const thread = await prisma.practiceThread.findFirst({
    where: {
      studentId,
      studioId: studio.id,
      date: dateStr,
    },
    include: {
      posts: {
        include: {
          recordings: true,
          comments: {
            include: { author: { select: { id: true, name: true, profileImage: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        where: { postId: null, pinned: true },
        include: { author: { select: { id: true, name: true, profileImage: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json({ success: true, data: { thread, student } });
}
