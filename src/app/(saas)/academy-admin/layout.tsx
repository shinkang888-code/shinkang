"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaasAuth } from "@/components/saas/useSaasAuth";
import { Users, LogOut, Building2, Loader2 } from "lucide-react";

export default function AcademyAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useSaasAuth(["ADMIN", "TEACHER"]);
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  const navItems = [
    { href: "/academy-admin/users", label: "원생/교사 관리", icon: <Users size={17} /> },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-indigo-900 text-white flex flex-col">
        <div className="p-5 border-b border-indigo-800">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={18} className="text-indigo-300" />
            <span className="font-bold text-white truncate">
              {user?.academy?.name ?? "학원 관리"}
            </span>
          </div>
          <p className="text-xs text-indigo-400 truncate">{user?.email}</p>
          <span className="inline-block mt-1 text-xs bg-indigo-700 text-indigo-200 px-2 py-0.5 rounded-full">
            {user?.role === "ADMIN" ? "관리자" : "선생님"}
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-indigo-600 text-white"
                  : "text-indigo-300 hover:bg-indigo-800 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-indigo-800">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-white w-full px-3 py-2 rounded-xl hover:bg-indigo-800"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 overflow-auto">
        <div className="p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
