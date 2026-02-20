"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import type { CalendarEvent } from "@/types";

// FullCalendar은 SSR 비호환이므로 dynamic import
const FullCalendarWrapper = dynamic(
  () => import("./FullCalendarWrapper"),
  { ssr: false, loading: () => <div className="h-[600px] bg-gray-50 rounded-2xl animate-pulse" /> }
);

interface Props {
  studioId: string;
  students: { id: string; name: string }[];
}

interface NewSchedule {
  studentId: string;
  lessonTitle: string;
  startAt: string;
  endAt: string;
  color: string;
}

export function AdminCalendar({ studioId, students }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [newSchedule, setNewSchedule] = useState<NewSchedule>({
    studentId: "",
    lessonTitle: "",
    startAt: "",
    endAt: "",
    color: "#4F46E5",
  });

  const fetchEvents = async (from: string, to: string) => {
    const res = await fetch(
      `/api/admin/schedules?studioId=${studioId}&from=${from}&to=${to}`
    );
    const json = await res.json();
    setEvents(json.data ?? []);
  };

  const handleDateSelect = (selectInfo: { startStr: string; endStr: string }) => {
    setNewSchedule((prev) => ({
      ...prev,
      startAt: selectInfo.startStr,
      endAt: selectInfo.endStr,
    }));
    setOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const handleCreateSchedule = async () => {
    if (!newSchedule.studentId || !newSchedule.lessonTitle) {
      toast.error("원생과 레슨 제목을 입력하세요.");
      return;
    }

    // 레슨 먼저 생성 후 스케줄 생성
    const lessonRes = await fetch("/api/admin/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studioId,
        title: newSchedule.lessonTitle,
        isRecurring: false,
        color: newSchedule.color,
      }),
    });
    const lessonJson = await lessonRes.json();
    if (!lessonRes.ok) { toast.error("레슨 생성 실패"); return; }

    const schedRes = await fetch("/api/admin/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studioId,
        lessonId: lessonJson.data.id,
        studentId: newSchedule.studentId,
        startAt: new Date(newSchedule.startAt).toISOString(),
        endAt: new Date(newSchedule.endAt).toISOString(),
      }),
    });
    if (schedRes.ok) {
      toast.success("레슨 일정이 추가되었습니다.");
      setOpen(false);
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
      fetchEvents(from, to);
    } else {
      toast.error("일정 추가 실패");
    }
  };

  const handleUpdateStatus = async (scheduleId: string, status: string) => {
    const res = await fetch(`/api/admin/schedules/${scheduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success("일정 상태 업데이트 완료");
      setSelectedEvent(null);
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
      fetchEvents(from, to);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/admin/schedules/${scheduleId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("일정이 삭제되었습니다.");
      setSelectedEvent(null);
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
      fetchEvents(from, to);
    }
  };

  const COLORS = [
    { value: "#4F46E5", label: "인디고" },
    { value: "#10B981", label: "에메랄드" },
    { value: "#F59E0B", label: "앰버" },
    { value: "#EF4444", label: "레드" },
    { value: "#8B5CF6", label: "바이올렛" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">레슨 일정</h1>
          <p className="text-sm text-gray-500 mt-1">날짜를 드래그하여 새 레슨을 추가하세요</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <CalendarPlus size={16} className="mr-2" />
          레슨 추가
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border-0 p-4">
        <FullCalendarWrapper
          events={events}
          onDateSelect={handleDateSelect}
          onEventClick={handleEventClick}
          onDatesSet={(from, to) => fetchEvents(from, to)}
        />
      </div>

      {/* 레슨 추가 Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>레슨 일정 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>원생 선택 *</Label>
              <Select
                value={newSchedule.studentId}
                onValueChange={(v) => setNewSchedule((p) => ({ ...p, studentId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="원생 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>레슨 제목 *</Label>
              <Input
                placeholder="예: 피아노 레슨, 체르니 연습"
                value={newSchedule.lessonTitle}
                onChange={(e) => setNewSchedule((p) => ({ ...p, lessonTitle: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>시작</Label>
                <Input
                  type="datetime-local"
                  value={newSchedule.startAt}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, startAt: e.target.value }))}
                />
              </div>
              <div>
                <Label>종료</Label>
                <Input
                  type="datetime-local"
                  value={newSchedule.endAt}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, endAt: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>색상</Label>
              <div className="flex gap-2 mt-1">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewSchedule((p) => ({ ...p, color: c.value }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      newSchedule.color === c.value ? "border-gray-800 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
              <Button onClick={handleCreateSchedule}>추가</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 이벤트 상세 Dialog */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedEvent.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                <strong>시작:</strong>{" "}
                {new Date(selectedEvent.start).toLocaleString("ko-KR")}
              </p>
              <p className="text-sm text-gray-600">
                <strong>종료:</strong>{" "}
                {new Date(selectedEvent.end).toLocaleString("ko-KR")}
              </p>
              <p className="text-sm text-gray-600">
                <strong>상태:</strong>{" "}
                {(selectedEvent.extendedProps?.status as string) ?? "SCHEDULED"}
              </p>
              <div className="flex gap-2 flex-wrap pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedEvent.id, "COMPLETED")}
                >
                  완료 처리
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedEvent.id, "ABSENT")}
                >
                  결석 처리
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteSchedule(selectedEvent.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
