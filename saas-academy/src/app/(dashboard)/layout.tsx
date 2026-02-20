"use client";

import { AuthProvider, useAuth } from "@/lib/auth/context";
import { Toast } from "@/components/ui/Toast";
import { Sidebar } from "@/components/layout/Sidebar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  // Build nav items based on role
  const navItems =
    user.role === "SUPER_ADMIN"
      ? [
          { href: "/super-admin/academies", label: "Academies", icon: "🏫" },
          { href: "/super-admin/users",     label: "All Users",  icon: "👥" },
        ]
      : user.role === "ADMIN"
      ? [
          { href: "/academy-admin/users",         label: "Users",         icon: "👥" },
          { href: "/academy-admin/invites",       label: "Invites",       icon: "✉️" },
          { href: "/academy-admin/tuition-plans", label: "Tuition Plans", icon: "📋" },
          { href: "/academy-admin/subscriptions", label: "Subscriptions", icon: "🔄" },
          { href: "/academy-admin/invoices",      label: "Invoices",      icon: "🧾" },
          { href: "/academy-admin/classes",       label: "Classes",       icon: "🏫" },
        ]
      : user.role === "TEACHER"
      ? [
          { href: "/teacher/classes",  label: "My Classes",  icon: "🏫" },
        ]
      : [
          { href: "/me",              label: "My Profile",  icon: "👤" },
          { href: "/me/billing",      label: "Billing",     icon: "💳" },
          { href: "/me/invoices",     label: "Invoices",    icon: "🧾" },
          { href: "/me/schedule",     label: "Schedule",    icon: "📅" },
          { href: "/me/attendance",   label: "Attendance",  icon: "✅" },
        ];

  const title =
    user.role === "SUPER_ADMIN"
      ? "Super Admin"
      : user.role === "ADMIN"
      ? "Academy Admin"
      : user.role === "TEACHER"
      ? "Teacher"
      : "Student";

  return (
    <Toast>
      <div className="flex min-h-screen">
        <Sidebar navItems={navItems} title={title} role={user.role} email={user.email} />
        <main className="ml-60 flex-1 p-8 max-w-7xl">
          {children}
        </main>
      </div>
    </Toast>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
