import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminCalendar } from "@/components/calendar/AdminCalendar";

export const metadata = { title: "레슨 일정" };

export default async function AdminSchedulePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const studio = await prisma.studio.findFirst({
    where: { adminId: session.user.id, isActive: true },
    include: { students: { where: { isActive: true }, include: { user: true } } },
  });

  if (!studio) return <div className="p-6 text-gray-500">학원 정보가 없습니다.</div>;

  const students = studio.students.map((s) => ({
    id: s.id,
    name: s.user.name ?? s.user.email,
  }));

  return <AdminCalendar studioId={studio.id} students={students} />;
}
