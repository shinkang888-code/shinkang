import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TeacherPracticeClient } from "@/components/teacher/TeacherPracticeClient";

export const metadata = { title: "연습 기록 검토" };

export default async function TeacherStudentPracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER") redirect("/login");

  const { id: studentId } = await params;

  // Verify teacher has access to this studio
  const studioTeacher = await prisma.studioTeacher.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { studio: true },
  });

  if (!studioTeacher) redirect("/teacher/dashboard");

  // Verify student is in the studio
  const student = await prisma.student.findFirst({
    where: { id: studentId, studioId: studioTeacher.studio.id, isActive: true },
    include: {
      user: { select: { id: true, name: true, email: true, profileImage: true } },
    },
  });

  if (!student) redirect("/teacher/students");

  return (
    <div>
      <div className="mb-6">
        <nav className="text-sm text-gray-500 mb-2">
          <a href="/teacher/students" className="hover:text-indigo-600">원생 목록</a>
          <span className="mx-2">·</span>
          <span className="text-gray-900">{student.user.name ?? "이름 없음"}</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">연습 기록 검토</h1>
      </div>

      <TeacherPracticeClient
        studentId={studentId}
        student={{
          id: student.id,
          user: { name: student.user.name, email: student.user.email },
          grade: student.grade,
        }}
      />
    </div>
  );
}
