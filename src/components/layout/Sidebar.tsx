"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CreditCard,
  Bell,
  LogOut,
  Music,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export const adminNavItems: NavItem[] = [
  { href: "/admin/dashboard", label: "대시보드", icon: <LayoutDashboard size={18} /> },
  { href: "/admin/students", label: "원생 관리", icon: <Users size={18} /> },
  { href: "/admin/teachers", label: "선생님 관리", icon: <GraduationCap size={18} /> },
  { href: "/admin/schedule", label: "레슨 일정", icon: <CalendarDays size={18} /> },
  { href: "/admin/payments", label: "수강료 관리", icon: <CreditCard size={18} /> },
  { href: "/admin/notifications", label: "알림 발송", icon: <Bell size={18} /> },
];

export const teacherNavItems: NavItem[] = [
  { href: "/teacher/dashboard", label: "대시보드", icon: <LayoutDashboard size={18} /> },
  { href: "/teacher/students", label: "원생 연습 관리", icon: <Users size={18} /> },
];

export const studentNavItems: NavItem[] = [
  { href: "/student/dashboard", label: "내 현황", icon: <LayoutDashboard size={18} /> },
  { href: "/student/schedule", label: "내 일정", icon: <CalendarDays size={18} /> },
  { href: "/student/practice", label: "피아노 연습", icon: <Music size={18} /> },
  { href: "/student/payments", label: "납부 내역", icon: <CreditCard size={18} /> },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  let navItems: NavItem[];
  let roleLabel: string;
  if (user.role === "ADMIN") {
    navItems = adminNavItems;
    roleLabel = "관리자";
  } else if (user.role === "TEACHER") {
    navItems = teacherNavItems;
    roleLabel = "선생님";
  } else {
    navItems = studentNavItems;
    roleLabel = "원생";
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
          <span className="text-lg">🎹</span>
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900">피아노 학원</p>
          <p className="text-xs text-gray-400">{roleLabel}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-indigo-50 text-indigo-700 shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <span className={isActive ? "text-indigo-600" : "text-gray-400"}>
                {item.icon}
              </span>
              {item.label}
              {isActive && (
                <ChevronRight size={14} className="ml-auto text-indigo-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-gray-50 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.image ?? ""} />
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                  {user.name?.charAt(0) ?? user.email?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name ?? "사용자"}
                </p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600"
            >
              <LogOut size={14} className="mr-2" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
