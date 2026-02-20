import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentDashboardClient } from "@/components/student/StudentDashboardClient";

export const metadata = { title: "내 현황" };

export default async function StudentDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/admin/dashboard");

  return <StudentDashboardClient />;
}
