"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaasAuth } from "@/components/saas/useSaasAuth";
import { Building2, Users, LogOut, ShieldCheck, Loader2 } from "lucide-react";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useSaasAuth("SUPER_ADMIN");
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  const navItems = [
    { href: "/super-admin/academies", label: "학원 관리", icon: <Building2 size={17} /> },
    { href: "/super-admin/users", label: "전체 사용자", icon: <Users size={17} /> },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-purple-400" />
            <span className="font-bold text-white">슈퍼 어드민</span>
          </div>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-purple-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white w-full px-3 py-2 rounded-xl hover:bg-slate-800"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 bg-slate-50 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
