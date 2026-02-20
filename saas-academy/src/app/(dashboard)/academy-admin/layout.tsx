import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toast } from "@/components/ui/Toast";

const NAV = [
  { href: "/academy-admin/dashboard",     label: "대시보드",       icon: "📊" },
  { href: "/academy-admin/users",         label: "Users",         icon: "👥" },
  { href: "/academy-admin/invites",       label: "Invites",       icon: "✉️" },
  { href: "/academy-admin/tuition-plans", label: "Tuition Plans", icon: "📋" },
  { href: "/academy-admin/subscriptions", label: "Subscriptions", icon: "🔄" },
  { href: "/academy-admin/invoices",      label: "Invoices",      icon: "🧾" },
  { href: "/academy-admin/classes",       label: "Classes",       icon: "🏫" },
  { href: "/academy-admin/notifications", label: "알림 설정",      icon: "🔔" },
];

export default async function AcademyAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/login");

  return (
    <Toast>
      <div className="flex min-h-screen">
        <Sidebar
          navItems={NAV}
          title="Academy Admin"
          role={user.role}
          email={user.id}
        />
        <main className="ml-60 flex-1 bg-gray-50 min-h-screen">
          <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </Toast>
  );
}
