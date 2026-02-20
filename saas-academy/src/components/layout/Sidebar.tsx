"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";

interface NavItem {
  href: string;
  label: string;
  icon?: string;
}

interface SidebarProps {
  navItems: NavItem[];
  title: string;
  role: string;
  email: string;
}

export function Sidebar({ navItems, title, role, email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="flex h-screen w-60 flex-col bg-brand-900 text-white fixed inset-y-0 left-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-brand-700">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-100 opacity-60 mb-0.5">
          Academy SaaS
        </p>
        <p className="text-base font-bold text-white truncate">{title}</p>
        <span className="mt-1 inline-block px-2 py-0.5 rounded text-xs bg-brand-700 text-brand-100">
          {role}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(item.href)
                ? "bg-brand-600 text-white"
                : "text-brand-200 hover:bg-brand-800 hover:text-white",
            )}
          >
            {item.icon && <span>{item.icon}</span>}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-brand-700 px-4 py-4">
        <p className="text-xs text-brand-300 truncate mb-2">{email}</p>
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm text-brand-300 hover:text-white transition-colors"
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}
