import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentPracticeClient } from "@/components/practice/StudentPracticeClient";

export const metadata = { title: "피아노 연습" };

export default async function PracticePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/admin/dashboard");

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🎹 피아노 연습</h1>
        <p className="text-gray-500 text-sm mt-1">
          매일 연습을 기록하고 선생님의 피드백을 받아보세요
        </p>
      </div>
      <StudentPracticeClient
        userId={session.user.id}
        userName={session.user.name ?? "학생"}
        userRole={session.user.role ?? "STUDENT"}
      />
    </div>
  );
}
