"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/types";

const FullCalendarWrapper = dynamic(
  () => import("./FullCalendarWrapper"),
  { ssr: false, loading: () => <div className="h-[600px] bg-gray-50 rounded-2xl animate-pulse" /> }
);

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  SCHEDULED: { label: "예정", variant: "default" },
  COMPLETED: { label: "완료", variant: "secondary" },
  CANCELLED: { label: "취소", variant: "outline" },
  ABSENT: { label: "결석", variant: "destructive" },
};

export function StudentCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const fetchEvents = async (from: string, to: string) => {
    const res = await fetch(`/api/student/schedule?from=${from}&to=${to}`);
    const json = await res.json();
    setEvents(json.data ?? []);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">내 레슨 일정</h1>
        <p className="text-sm text-gray-500 mt-1">나의 레슨 일정을 확인하세요</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <FullCalendarWrapper
          events={events}
          onDateSelect={() => {}}
          onEventClick={setSelected}
          onDatesSet={fetchEvents}
        />
      </div>

      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-gray-600">
                <strong>시작:</strong> {new Date(selected.start).toLocaleString("ko-KR")}
              </p>
              <p className="text-gray-600">
                <strong>종료:</strong> {new Date(selected.end).toLocaleString("ko-KR")}
              </p>
              <div className="flex items-center gap-2">
                <strong className="text-gray-700">상태:</strong>
                <Badge variant={STATUS_MAP[selected.extendedProps?.status as string]?.variant ?? "default"}>
                  {STATUS_MAP[selected.extendedProps?.status as string]?.label ?? "예정"}
                </Badge>
              </div>
              {selected.extendedProps?.memo ? (
                <p className="text-gray-600">
                  <strong>메모:</strong>{" "}
                  <span>{String(selected.extendedProps.memo)}</span>
                </p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
