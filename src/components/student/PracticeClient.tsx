"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Music, Play, Square, Clock, Flame } from "lucide-react";
import type { PracticeSessionDTO } from "@/types";

interface PracticeData {
  sessions: PracticeSessionDTO[];
  activeSession: PracticeSessionDTO | null;
}

export function PracticeClient() {
  const [data, setData] = useState<PracticeData>({ sessions: [], activeSession: null });
  const [timer, setTimer] = useState(0);
  const [piece, setPiece] = useState("");

  const fetchData = () => {
    fetch("/api/student/practice")
      .then((r) => r.json())
      .then((j) => {
        setData(j.data ?? { sessions: [], activeSession: null });
        if (j.data?.activeSession) {
          const elapsed = Math.floor(
            (Date.now() - new Date(j.data.activeSession.startedAt).getTime()) / 1000
          );
          setTimer(elapsed);
        }
      });
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!data.activeSession) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [data.activeSession]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}시간 ${String(m).padStart(2, "0")}분 ${String(sec).padStart(2, "0")}초`
      : `${String(m).padStart(2, "0")}분 ${String(sec).padStart(2, "0")}초`;
  };

  const fmtMin = (min: number) => {
    if (min >= 60) return `${Math.floor(min / 60)}시간 ${min % 60}분`;
    return `${min}분`;
  };

  const handleStart = async () => {
    const res = await fetch("/api/student/practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ piece }),
    });
    if (res.ok) {
      toast.success("연습을 시작했습니다! 🎹");
      setPiece("");
      fetchData();
    } else {
      const j = await res.json();
      toast.error(j.error ?? "시작 실패");
    }
  };

  const handleStop = async () => {
    if (!data.activeSession) return;
    const res = await fetch(`/api/student/practice/${data.activeSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const j = await res.json();
      toast.success(`연습 완료! ${fmtMin(j.data.durationMin ?? 0)} 연습했습니다.`);
      setTimer(0);
      fetchData();
    }
  };

  const totalMinutes = data.sessions
    .filter((s) => s.endedAt)
    .reduce((sum, s) => sum + (s.durationMin ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">연습 세션</h1>
        <p className="text-sm text-gray-500 mt-1">연습을 시작하고 기록을 관리하세요</p>
      </div>

      {/* 연습 컨트롤 */}
      <Card className={`border-0 shadow-sm rounded-2xl overflow-hidden ${data.activeSession ? "bg-indigo-600" : "bg-white"}`}>
        <CardContent className="p-6">
          {data.activeSession ? (
            <div className="text-white text-center space-y-4">
              <div className="inline-flex p-4 bg-white/20 rounded-2xl">
                <Music size={32} className="text-white" />
              </div>
              <div>
                <p className="text-indigo-200 text-sm">연습 중</p>
                {data.activeSession.piece && (
                  <p className="text-white font-medium">🎵 {data.activeSession.piece}</p>
                )}
                <p className="text-4xl font-bold font-mono mt-2">{fmt(timer)}</p>
              </div>
              <Button
                variant="outline"
                size="lg"
                className="bg-white text-indigo-600 border-white hover:bg-indigo-50 w-full max-w-xs"
                onClick={handleStop}
              >
                <Square size={16} className="mr-2" />
                연습 종료
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 rounded-xl">
                  <Play size={22} className="text-indigo-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">새 연습 시작</p>
                  <p className="text-sm text-gray-400">연습할 곡을 입력하고 시작하세요 (선택)</p>
                </div>
              </div>
              <div>
                <Label className="text-sm">연습 곡 (선택)</Label>
                <Input
                  placeholder="예: 쇼팽 야상곡, 하농 연습"
                  value={piece}
                  onChange={(e) => setPiece(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button onClick={handleStart} size="lg" className="w-full">
                <Play size={16} className="mr-2" />
                연습 시작 🎹
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Clock size={18} className="text-blue-500" />
              <p className="text-sm text-gray-500">총 연습 시간</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmtMin(totalMinutes)}</p>
            <p className="text-xs text-gray-400 mt-1">{data.sessions.filter((s) => s.endedAt).length}회</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Flame size={18} className="text-orange-500" />
              <p className="text-sm text-gray-500">최근 세션 평균</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data.sessions.filter((s) => s.endedAt).length > 0
                ? fmtMin(Math.round(totalMinutes / data.sessions.filter((s) => s.endedAt).length))
                : "0분"}
            </p>
            <p className="text-xs text-gray-400 mt-1">최근 {Math.min(data.sessions.length, 20)}회 기준</p>
          </CardContent>
        </Card>
      </div>

      {/* 연습 기록 */}
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">연습 기록</CardTitle>
        </CardHeader>
        <CardContent>
          {data.sessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">연습 기록이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {data.sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.piece ?? "연습"}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.startedAt).toLocaleDateString("ko-KR", {
                        month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    {s.endedAt ? (
                      <Badge variant="outline" className="text-xs">
                        {fmtMin(s.durationMin ?? 0)}
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-indigo-100 text-indigo-700">진행 중</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
