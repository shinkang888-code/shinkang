import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "선생님 대시보드" };

export default async function TeacherDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEACHER") redirect("/login");

  // Get teacher's studio
  const studioTeacher = await prisma.studioTeacher.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: { studio: true },
  });

  if (!studioTeacher) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-lg">소속 학원이 없습니다.</p>
          <p className="text-gray-400 text-sm mt-2">관리자에게 문의하세요.</p>
        </div>
      </div>
    );
  }

  const studio = studioTeacher.studio;

  // Count active students
  const studentCount = await prisma.student.count({
    where: { studioId: studio.id, isActive: true },
  });

  // Count today's submitted/reviewed posts
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaySubmissions = await prisma.practicePost.count({
    where: {
      studioId: studio.id,
      status: "SUBMITTED",
      createdAt: { gte: today, lt: tomorrow },
    },
  });

  const pendingReviews = await prisma.practicePost.count({
    where: {
      studioId: studio.id,
      status: "SUBMITTED",
    },
  });

  // Recent submitted posts
  const recentPosts = await prisma.practicePost.findMany({
    where: { studioId: studio.id, status: "SUBMITTED" },
    include: {
      student: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">선생님 대시보드</h1>
        <p className="text-gray-500 mt-1">{studio.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">담당 원생</p>
          <p className="text-3xl font-bold text-indigo-600">{studentCount}</p>
          <p className="text-xs text-gray-400 mt-1">명</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">오늘 제출</p>
          <p className="text-3xl font-bold text-green-600">{todaySubmissions}</p>
          <p className="text-xs text-gray-400 mt-1">건</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">검토 대기</p>
          <p className="text-3xl font-bold text-orange-500">{pendingReviews}</p>
          <p className="text-xs text-gray-400 mt-1">건</p>
        </div>
      </div>

      {/* Recent submissions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">검토 대기 연습 기록</h2>
        {recentPosts.length === 0 ? (
          <p className="text-gray-400 text-sm">검토 대기 중인 연습 기록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <a
                key={post.id}
                href={`/teacher/students/${post.studentId}/practice`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {post.student.user.name ?? "이름 없음"}
                  </p>
                  <p className="text-sm text-gray-500">{post.pieceTitle} · {post.practiceCount}회</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    검토 대기
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
