import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Music, User, Users } from "lucide-react";

export const metadata = { title: "원생 연습 관리" };

export default async function TeacherStudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER") redirect("/login");

  const studioTeacher = await prisma.studioTeacher.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { studio: true },
  });

  if (!studioTeacher) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">소속 학원이 없습니다.</p>
      </div>
    );
  }

  const students = await prisma.student.findMany({
    where: { studioId: studioTeacher.studio.id, isActive: true },
    include: {
      user: { select: { id: true, name: true, email: true, profileImage: true } },
      practicePosts: {
        where: { status: "SUBMITTED" },
        select: { id: true },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">원생 연습 관리</h1>
        <p className="text-gray-500 mt-1">각 원생의 연습 기록을 확인하고 피드백을 남기세요.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map((student) => (
          <Link
            key={student.id}
            href={`/teacher/students/${student.id}/practice`}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                {student.user.profileImage ? (
                  <img
                    src={student.user.profileImage}
                    alt={student.user.name ?? ""}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <User size={24} className="text-indigo-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {student.user.name ?? "이름 없음"}
                </p>
                <p className="text-sm text-gray-500 truncate">{student.user.email}</p>
                {student.grade && (
                  <p className="text-xs text-gray-400">{student.grade}</p>
                )}
              </div>
            </div>
            {student.practicePosts.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Music size={14} className="text-orange-500" />
                <span className="text-sm text-orange-600 font-medium">
                  검토 대기 {student.practicePosts.length}건
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>

      {students.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p>등록된 원생이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
