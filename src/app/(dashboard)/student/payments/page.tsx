import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentPaymentsClient } from "@/components/student/StudentPaymentsClient";

export const metadata = { title: "납부 내역" };

export default async function StudentPaymentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/admin/payments");
  return <StudentPaymentsClient />;
}
