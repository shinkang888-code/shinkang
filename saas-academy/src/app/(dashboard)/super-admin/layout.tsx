import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toast } from "@/components/ui/Toast";

const NAV = [
  { href: "/super-admin/academies", label: "Academies", icon: "🏫" },
  { href: "/super-admin/users",     label: "All Users",  icon: "👥" },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") redirect("/login");

  return (
    <Toast>
      <div className="flex min-h-screen">
        <Sidebar
          navItems={NAV}
          title="Super Admin"
          role={user.role}
          email={user.id}
        />
        <main className="ml-60 flex-1 bg-gray-50 min-h-screen">
          <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </Toast>
  );
}
