// GET /api/teacher/students - 선생님의 스튜디오 내 학생 목록
import { NextResponse } from "next/server";
import { requireTeacher, getTeacherStudio } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const studio = await getTeacherStudio(session!.user.id);
  if (!studio) {
    return NextResponse.json({ success: false, error: "소속 학원이 없습니다." }, { status: 403 });
  }

  const students = await prisma.student.findMany({
    where: { studioId: studio.id, isActive: true },
    include: {
      user: { select: { id: true, name: true, email: true, profileImage: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json({ success: true, data: students });
}
