"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  CreditCard,
  CalendarDays,
  Music,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardStats, PaymentDTO } from "@/types";

interface Props {
  studioId: string;
  studioName: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentPayments: (PaymentDTO & {
    student: { user: { name?: string | null } };
  })[];
}

export function AdminDashboardClient({ studioId, studioName }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!studioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dashboard?studioId=${studioId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = await res.json();
      setData(j.data);
    } catch (err) {
      console.error("[Dashboard] fetch error:", err);
      setError("데이터를 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [studioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!studioId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        학원 정보가 없습니다.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-gray-500">{error}</p>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw size={14} className="mr-2" />
          다시 시도
        </Button>
      </div>
    );
  }

  const stats = data?.stats;

  const statCards = [
    {
      title: "전체 원생",
      value: stats?.totalStudents ?? 0,
      sub: `활성 ${stats?.activeStudents ?? 0}명`,
      icon: <Users size={20} className="text-indigo-500" />,
      bg: "bg-indigo-50",
    },
    {
      title: "이번 달 수입",
      value: `${(stats?.totalRevenue ?? 0).toLocaleString()}원`,
      sub: `미납 ${stats?.pendingPayments ?? 0}건`,
      icon: <CreditCard size={20} className="text-emerald-500" />,
      bg: "bg-emerald-50",
      alert: (stats?.overduePayments ?? 0) > 0,
    },
    {
      title: "오늘 레슨",
      value: `${stats?.todayLessons ?? 0}건`,
      sub: "예정된 레슨",
      icon: <CalendarDays size={20} className="text-blue-500" />,
      bg: "bg-blue-50",
    },
    {
      title: "이번 달 연습",
      value: `${stats?.monthlyPracticeSessions ?? 0}회`,
      sub: "연습 세션 합계",
      icon: <Music size={20} className="text-purple-500" />,
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{studioName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      {/* 연체 알림 */}
      {(stats?.overduePayments ?? 0) > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <strong>{stats?.overduePayments}명</strong>의 원생이 수강료를
            연체 중입니다.
          </p>
          <a
            href="/admin/payments"
            className="ml-auto text-xs text-red-600 underline whitespace-nowrap"
          >
            확인하기
          </a>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card
            key={card.title}
            className="border-0 shadow-sm rounded-2xl overflow-hidden"
          >
            <CardContent className="p-5">
              <div className={`inline-flex p-2 rounded-xl ${card.bg} mb-3`}>
                {card.icon}
              </div>
              <p className="text-xs text-gray-500 font-medium">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {card.value}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400">{card.sub}</p>
                {card.alert && (
                  <Badge
                    variant="destructive"
                    className="text-xs px-1.5 py-0"
                  >
                    연체 {stats?.overduePayments}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 최근 납부 */}
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp size={16} className="text-gray-400" />
            최근 납부 내역
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.recentPayments?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              납부 내역이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {data?.recentPayments?.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {p.student?.user?.name ?? "원생"}
                    </p>
                    <p className="text-xs text-gray-400">{p.billingMonth}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {p.amount.toLocaleString()}원
                    </p>
                    <Badge
                      variant={
                        p.status === "PAID"
                          ? "default"
                          : p.status === "OVERDUE"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {p.status === "PAID"
                        ? "납부완료"
                        : p.status === "OVERDUE"
                        ? "연체"
                        : "미납"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 빠른 이동 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/admin/students", label: "원생 관리", icon: "👥" },
          { href: "/admin/schedule", label: "레슨 일정", icon: "📅" },
          { href: "/admin/payments", label: "수강료 관리", icon: "💳" },
          { href: "/admin/notifications", label: "알림 발송", icon: "💬" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm font-medium text-gray-700">
              {item.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
