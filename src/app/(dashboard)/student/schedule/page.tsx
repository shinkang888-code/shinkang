import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentCalendar } from "@/components/calendar/StudentCalendar";

export const metadata = { title: "내 일정" };

export default async function StudentSchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/admin/schedule");
  return <StudentCalendar />;
}
