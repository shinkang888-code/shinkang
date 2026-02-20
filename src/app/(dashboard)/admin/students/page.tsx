import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StudentsClient } from "@/components/admin/StudentsClient";

export const metadata = { title: "원생 관리" };

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const studio = await prisma.studio.findFirst({
    where: { adminId: session.user.id, isActive: true },
  });

  if (!studio) return <div className="p-6 text-gray-500">학원 정보가 없습니다.</div>;

  return <StudentsClient studioId={studio.id} />;
}
