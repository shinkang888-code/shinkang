import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPracticeClient } from "@/components/practice/AdminPracticeClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  return { title: `${student?.user.name ?? "원생"} 연습 기록` };
}

export default async function AdminStudentPracticePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/student/dashboard");

  const { id: studentId } = await params;

  // Get student + verify admin owns the studio
  const student = await prisma.student.findFirst({
    where: { id: studentId, isActive: true },
    include: {
      user: { select: { name: true, email: true } },
      studio: { select: { id: true, adminId: true, name: true } },
    },
  });

  if (!student) redirect("/admin/students");
  if (student.studio.adminId !== session.user.id) redirect("/admin/students");

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <a href="/admin/students" className="hover:text-gray-700">원생 관리</a>
          <span>/</span>
          <span>{student.user.name}</span>
          <span>/</span>
          <span className="text-gray-900">연습 기록</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">🎹 연습 기록 검토</h1>
        <p className="text-gray-500 text-sm mt-1">
          {student.studio.name} · {student.user.name} 원생
        </p>
      </div>

      <AdminPracticeClient
        studentId={studentId}
        studioId={student.studio.id}
        adminId={session.user.id}
        student={{
          id: student.id,
          name: student.user.name ?? "원생",
          user: { name: student.user.name, email: student.user.email },
        }}
      />
    </div>
  );
}
