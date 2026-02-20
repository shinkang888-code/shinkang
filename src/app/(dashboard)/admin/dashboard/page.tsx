import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export const metadata = { title: "대시보드" };

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  let studioId = "";
  let studioName = "내 학원";

  try {
    const studio = await prisma.studio.findFirst({
      where: { adminId: session.user.id, isActive: true },
    });

    if (!studio) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-gray-500">등록된 학원이 없습니다.</p>
          <a href="/register" className="text-indigo-600 underline text-sm">
            학원 등록하기
          </a>
        </div>
      );
    }

    studioId = studio.id;
    studioName = studio.name;
  } catch (err) {
    console.error("[AdminDashboard] DB error:", err);
  }

  return <AdminDashboardClient studioId={studioId} studioName={studioName} />;
}
