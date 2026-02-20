"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, CreditCard, Calendar, Loader2, Info } from "lucide-react";

interface Props {
  studioId: string;
  students: { id: string; name: string }[];
}

const NOTIFICATION_TYPES = [
  {
    type: "PAYMENT_DUE" as const,
    title: "납부 예정 알림",
    description: "납부 예정인 미납 원생들에게 수강료 납부를 안내합니다.",
    icon: <CreditCard size={20} className="text-blue-500" />,
    bg: "bg-blue-50",
    badge: "미납 원생",
  },
  {
    type: "PAYMENT_OVERDUE" as const,
    title: "연체 알림",
    description: "납부 기한이 지난 원생들에게 연체 알림을 발송합니다.",
    icon: <CreditCard size={20} className="text-red-500" />,
    bg: "bg-red-50",
    badge: "연체 원생",
  },
  {
    type: "LESSON_REMINDER" as const,
    title: "레슨 리마인드",
    description: "내일 레슨이 있는 원생들에게 레슨 일정을 알립니다.",
    icon: <Calendar size={20} className="text-purple-500" />,
    bg: "bg-purple-50",
    badge: "내일 레슨",
  },
];

export function NotificationsClient({ studioId, students }: Props) {
  const [sending, setSending] = useState<string | null>(null);

  const handleSend = async (type: "PAYMENT_DUE" | "PAYMENT_OVERDUE" | "LESSON_REMINDER") => {
    setSending(type);
    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioId, type }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`${json.data.sent}명에게 알림을 발송했습니다.`);
      } else {
        toast.error(json.error ?? "발송 실패");
      }
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">카카오톡 알림 발송</h1>
        <p className="text-sm text-gray-500 mt-1">원생들에게 카카오톡 메시지를 발송합니다</p>
      </div>

      {/* 안내 */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
        <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">카카오톡 알림 발송 조건</p>
          <ul className="space-y-1 text-xs list-disc list-inside text-amber-700">
            <li>원생이 카카오 계정으로 로그인한 경우에만 발송됩니다</li>
            <li>카카오 로그인 시 <strong>카카오톡 메시지 발송</strong> 동의가 필요합니다</li>
            <li>미동의/미연동 원생은 <Badge variant="outline" className="text-xs">SKIPPED</Badge> 처리됩니다</li>
          </ul>
        </div>
      </div>

      {/* 알림 타입 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        {NOTIFICATION_TYPES.map((nt) => (
          <Card key={nt.type} className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <div className={`inline-flex p-2.5 rounded-xl ${nt.bg} mb-2 w-fit`}>
                {nt.icon}
              </div>
              <CardTitle className="text-base">{nt.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">{nt.description}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{nt.badge}</Badge>
                <span className="text-xs text-gray-400">대상</span>
              </div>
              <Button
                className="w-full"
                onClick={() => handleSend(nt.type)}
                disabled={sending === nt.type}
              >
                {sending === nt.type ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />발송 중...</>
                ) : (
                  <><Bell size={14} className="mr-2" />발송하기</>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 원생 수 */}
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">원생 현황 ({students.length}명)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {students.slice(0, 12).map((s) => (
              <div key={s.id} className="text-center p-2 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-gray-700 truncate">{s.name}</p>
              </div>
            ))}
            {students.length > 12 && (
              <div className="text-center p-2 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400">+{students.length - 12}명</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
