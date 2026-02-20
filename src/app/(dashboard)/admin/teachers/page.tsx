import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TeachersClient } from "@/components/admin/TeachersClient";

export const metadata = { title: "선생님 관리" };

export default async function AdminTeachersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/admin/dashboard");

  const studio = await prisma.studio.findFirst({
    where: { adminId: session.user.id },
  });

  if (!studio) redirect("/admin/dashboard");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">선생님 관리</h1>
        <p className="text-gray-500 mt-1">학원 선생님 계정을 관리합니다.</p>
      </div>
      <TeachersClient studioId={studio.id} />
    </div>
  );
}
