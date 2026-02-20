// GET /api/teacher/profile - 선생님 프로필 + 소속 스튜디오
import { NextResponse } from "next/server";
import { requireTeacher, getTeacherStudio } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const studio = await getTeacherStudio(session!.user.id);

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { id: true, name: true, email: true, phone: true, profileImage: true, role: true, createdAt: true },
  });

  return NextResponse.json({ success: true, data: { user, studio } });
}
