"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, CalendarDays, CreditCard, TrendingUp } from "lucide-react";
import Link from "next/link";

interface Stats {
  practice: {
    totalSessions: number;
    monthlySessions: number;
    weeklySessions: number;
    totalMinutes: number;
    monthlyMinutes: number;
  };
  lessons: { completedLessons: number };
  payments: { pendingPayments: number };
}

export function StudentDashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [practiceActive, setPracticeActive] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    fetch("/api/student/stats").then((r) => r.json()).then((j) => setStats(j.data));
    fetch("/api/student/practice").then((r) => r.json()).then((j) => {
      if (j.data?.activeSession) {
        setPracticeActive(true);
        setActiveSessionId(j.data.activeSession.id);
        const elapsed = Math.floor(
          (Date.now() - new Date(j.data.activeSession.startedAt).getTime()) / 1000
        );
        setTimer(elapsed);
      }
    });
  }, []);

  // 타이머
  useEffect(() => {
    if (!practiceActive) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [practiceActive]);

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleStartPractice = async () => {
    const res = await fetch("/api/student/practice", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const json = await res.json();
    if (res.ok) {
      setPracticeActive(true);
      setActiveSessionId(json.data.id);
      setTimer(0);
    }
  };

  const handleStopPractice = async () => {
    if (!activeSessionId) return;
    const res = await fetch(`/api/student/practice/${activeSessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (res.ok) {
      setPracticeActive(false);
      setActiveSessionId(null);
      setTimer(0);
      const j = await fetch("/api/student/stats").then((r) => r.json());
      setStats(j.data);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">내 현황</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* 연습 세션 위젯 */}
      <Card className={`border-0 shadow-sm rounded-2xl overflow-hidden transition-all ${practiceActive ? "bg-indigo-600 text-white" : "bg-white"}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${practiceActive ? "text-indigo-200" : "text-gray-500"}`}>
                {practiceActive ? "연습 중..." : "연습 시작"}
              </p>
              {practiceActive ? (
                <p className="text-4xl font-bold font-mono mt-1">{formatTimer(timer)}</p>
              ) : (
                <p className="text-lg font-semibold text-gray-800 mt-1">
                  이번 주 {stats?.practice.weeklySessions ?? 0}회 연습
                </p>
              )}
            </div>
            <div className={`p-4 rounded-2xl ${practiceActive ? "bg-white/20" : "bg-indigo-50"}`}>
              <Music size={28} className={practiceActive ? "text-white" : "text-indigo-500"} />
            </div>
          </div>
          <div className="mt-4">
            {practiceActive ? (
              <Button
                variant="outline"
                className="w-full bg-white text-indigo-600 border-white hover:bg-indigo-50"
                onClick={handleStopPractice}
              >
                연습 종료
              </Button>
            ) : (
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={handleStartPractice}
              >
                연습 시작 🎹
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            title: "이번 달 연습",
            value: `${stats?.practice.monthlySessions ?? 0}회`,
            sub: `총 ${Math.round((stats?.practice.monthlyMinutes ?? 0) / 60)}시간 ${(stats?.practice.monthlyMinutes ?? 0) % 60}분`,
            icon: <Music size={18} className="text-indigo-500" />,
            bg: "bg-indigo-50",
          },
          {
            title: "완료된 레슨",
            value: `${stats?.lessons.completedLessons ?? 0}회`,
            sub: "누적 완료 레슨",
            icon: <CalendarDays size={18} className="text-blue-500" />,
            bg: "bg-blue-50",
          },
          {
            title: "전체 연습 시간",
            value: `${Math.round((stats?.practice.totalMinutes ?? 0) / 60)}시간`,
            sub: `총 ${stats?.practice.totalSessions ?? 0}회`,
            icon: <TrendingUp size={18} className="text-emerald-500" />,
            bg: "bg-emerald-50",
          },
          {
            title: "미납 수강료",
            value: `${stats?.payments.pendingPayments ?? 0}건`,
            sub: stats?.payments.pendingPayments ? "납부 필요" : "모두 납부완료",
            icon: <CreditCard size={18} className="text-amber-500" />,
            bg: "bg-amber-50",
            alert: (stats?.payments.pendingPayments ?? 0) > 0,
          },
        ].map((card) => (
          <Card key={card.title} className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5">
              <div className={`inline-flex p-2 rounded-xl ${card.bg} mb-3`}>{card.icon}</div>
              <p className="text-xs text-gray-500">{card.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                {card.alert && <Badge variant="destructive" className="text-xs">미납</Badge>}
              </div>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/student/schedule">
          <Card className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl"><CalendarDays size={20} className="text-blue-500" /></div>
              <div>
                <p className="font-medium text-gray-800">내 레슨 일정</p>
                <p className="text-xs text-gray-400">달력에서 확인하기</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/student/payments">
          <Card className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-xl"><CreditCard size={20} className="text-amber-500" /></div>
              <div>
                <p className="font-medium text-gray-800">납부 내역</p>
                <p className="text-xs text-gray-400">수강료 확인하기</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
