"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WeeklyGoal } from "@/components/practice/WeeklyGoal";
import { RecordingPlayer } from "@/components/practice/RecordingPlayer";
import { type CommentData } from "@/components/practice/CommentSection";
import {
  ChevronLeft,
  ChevronRight,
  Pin,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquarePlus,
  Settings,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import type { PostData } from "@/components/practice/PracticePostCard";

interface StudentInfo {
  id: string;
  user: { name: string | null; email: string };
  grade?: string | null;
}

interface ThreadData {
  id: string;
  date: string;
  studioId: string;
  studentId: string;
  posts: PostData[];
  comments: CommentData[];
}

const INSTRUCTION_TEMPLATES = [
  { label: "템포", body: "이 곡의 템포를 더 정확하게 맞춰 연습해주세요." },
  { label: "손가락 번호", body: "손가락 번호를 지키면서 연습해주세요. 특히 음계 부분을 주의하세요." },
  { label: "구간 반복", body: "어려운 구간을 천천히 따로 반복 연습해주세요." },
  { label: "다이나믹", body: "강약 표현에 주의하며 연습해주세요 (p, mf, f 구분)." },
  { label: "리듬", body: "리듬을 정확히 지키면서 박자감을 키워주세요." },
];

function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatDateKo(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("ko-KR", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

interface TeacherPracticeClientProps {
  studentId: string;
  student: StudentInfo;
}

function statusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary">작성 중</Badge>;
    case "SUBMITTED":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">제출됨</Badge>;
    case "REVIEWED":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">검토 완료</Badge>;
    default:
      return null;
  }
}

export function TeacherPracticeClient({ studentId, student }: TeacherPracticeClientProps) {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState<{ weekTargetCount: number; submittedCount: number } | null>(null);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [instructionBody, setInstructionBody] = useState("");
  const [postingInstruction, setPostingInstruction] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [newTarget, setNewTarget] = useState(3);
  const [savingGoal, setSavingGoal] = useState(false);
  const [reviewStates, setReviewStates] = useState<Record<string, { open: boolean; comment: string; result: "OK" | "NG" | null }>>({});

  const weekStart = getWeekMonday(new Date(selectedDate + "T00:00:00Z"));

  const fetchThread = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/students/${studentId}/practice/thread?date=${date}`);
      if (!res.ok) throw new Error("불러오기 실패");
      const { data } = await res.json();
      setThread(data.thread ?? null);
    } catch {
      toast.error("연습 기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const fetchGoal = useCallback(async () => {
    try {
      const ws = getWeekMonday(new Date(selectedDate + "T00:00:00Z"));
      const res = await fetch(`/api/teacher/practice/goal?studentId=${studentId}&weekStart=${ws}`);
      if (!res.ok) return;
      const { data } = await res.json();
      setGoal({ weekTargetCount: data.weekTargetCount ?? 3, submittedCount: data.submittedCount ?? 0 });
      setNewTarget(data.weekTargetCount ?? 3);
    } catch {
      // silent
    }
  }, [selectedDate, studentId]);

  useEffect(() => { fetchThread(selectedDate); }, [selectedDate, fetchThread]);
  useEffect(() => { fetchGoal(); }, [weekStart, fetchGoal]);

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleReview = async (postId: string, reviewResult: "OK" | "NG") => {
    const state = reviewStates[postId];
    const reviewComment = state?.comment?.trim();
    try {
      const res = await fetch("/api/teacher/practice/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, reviewResult, reviewComment }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "검토 실패");
      }
      const { data } = await res.json();
      setThread((prev) =>
        prev ? {
          ...prev,
          posts: prev.posts.map((p) =>
            p.id === postId ? { ...p, status: data.status, reviewResult: data.reviewResult, reviewComment: data.reviewComment } : p
          ),
        } : prev
      );
      setReviewStates((prev) => ({ ...prev, [postId]: { open: false, comment: "", result: null } }));
      toast.success(reviewResult === "OK" ? "✅ 합격으로 검토 완료!" : "❌ 재연습 필요로 검토 완료!");
    } catch (e: unknown) {
      toast.error((e as Error).message || "검토 처리 실패");
    }
  };

  const handleInstruction = async () => {
    if (!instructionBody.trim() || !thread) return;
    setPostingInstruction(true);
    try {
      const res = await fetch("/api/teacher/practice/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          body: instructionBody.trim(),
          type: "INSTRUCTION",
        }),
      });
      if (!res.ok) throw new Error("등록 실패");
      const { data } = await res.json();
      setThread((prev) =>
        prev ? { ...prev, comments: [...prev.comments, data] } : prev
      );
      setInstructionBody("");
      setInstructionOpen(false);
      toast.success("지시사항이 등록되었습니다.");
    } catch {
      toast.error("지시사항 등록 실패");
    } finally {
      setPostingInstruction(false);
    }
  };

  const handleSaveGoal = async () => {
    setSavingGoal(true);
    try {
      const res = await fetch("/api/teacher/practice/goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, weekTargetCount: newTarget, basis: "SUBMISSION" }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setGoalOpen(false);
      toast.success("목표가 저장되었습니다.");
      fetchGoal();
    } catch {
      toast.error("목표 저장 실패");
    } finally {
      setSavingGoal(false);
    }
  };

  const handlePinToggle = async (commentId: string, pinned: boolean) => {
    try {
      const res = await fetch(`/api/teacher/practice/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) throw new Error("핀 변경 실패");
      setThread((prev) =>
        prev ? {
          ...prev,
          comments: prev.comments.map((c) => c.id === commentId ? { ...c, pinned } : c),
        } : prev
      );
      toast.success(pinned ? "📌 고정됨" : "📌 고정 해제");
    } catch {
      toast.error("핀 변경 실패");
    }
  };

  const handleAddComment = async (postId: string | null, body: string, type: string) => {
    if (!thread) return;
    try {
      const res = await fetch("/api/teacher/practice/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, postId, body, type }),
      });
      if (!res.ok) throw new Error("댓글 등록 실패");
      const { data } = await res.json();
      if (postId) {
        setThread((prev) =>
          prev ? {
            ...prev,
            posts: prev.posts.map((p) =>
              p.id === postId ? { ...p, comments: [...(p.comments ?? []), data] } : p
            ),
          } : prev
        );
      } else {
        setThread((prev) =>
          prev ? { ...prev, comments: [...prev.comments, data] } : prev
        );
      }
      toast.success("댓글이 등록되었습니다.");
    } catch {
      toast.error("댓글 등록 실패");
    }
  };

  const pinnedComments = thread?.comments.filter((c) => c.pinned) ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {student.user.name ?? "이름 없음"}
          </h2>
          <p className="text-sm text-gray-500">{student.user.email} {student.grade && `· ${student.grade}`}</p>
        </div>
        <div className="flex gap-2">
          {/* Goal settings */}
          <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Settings className="h-3 w-3" />
                목표 설정
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>주간 목표 설정</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <label className="text-sm font-medium mb-1 block">주간 제출 목표 횟수</label>
                <Select value={String(newTarget)} onValueChange={(v) => setNewTarget(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}회</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleSaveGoal} disabled={savingGoal} className="w-full">저장</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Instruction */}
          <Dialog open={instructionOpen} onOpenChange={setInstructionOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" disabled={!thread}>
                <MessageSquarePlus className="h-3 w-3" />
                지시사항 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>지시사항 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap gap-2">
                  {INSTRUCTION_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      onClick={() => setInstructionBody(tpl.body)}
                      className="text-xs px-2 py-1 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={instructionBody}
                  onChange={(e) => setInstructionBody(e.target.value)}
                  placeholder="지시사항을 입력하세요..."
                  className="resize-none h-24"
                />
                <Button
                  onClick={handleInstruction}
                  disabled={postingInstruction || !instructionBody.trim()}
                  className="w-full gap-2"
                >
                  <Pin className="h-3 w-3" />
                  {postingInstruction ? "등록 중..." : "핀 고정으로 등록"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <Button size="icon" variant="ghost" onClick={() => changeDate(-1)}><ChevronLeft size={16} /></Button>
        <div className="flex-1 text-center">
          <p className="font-medium text-gray-800">{formatDateKo(selectedDate)}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={() => changeDate(1)}><ChevronRight size={16} /></Button>
        <Button size="sm" variant="outline" onClick={() => setSelectedDate(todayString())}>오늘</Button>
      </div>

      {/* Weekly Goal */}
      {goal && (
        <WeeklyGoal
          weekStart={weekStart}
          weekEnd={(() => { const d = new Date(weekStart + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); })()}
          weekTargetCount={goal.weekTargetCount}
          actualCount={goal.submittedCount}
          achieved={goal.submittedCount >= goal.weekTargetCount}
        />
      )}

      {/* Pinned Instructions */}
      {pinnedComments.length > 0 && (
        <div className="space-y-2">
          {pinnedComments.map((c) => (
            <div key={c.id} className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <Pin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800 flex-1">{c.body}</p>
              <button
                onClick={() => handlePinToggle(c.id, false)}
                className="text-xs text-blue-400 hover:text-blue-600"
              >
                해제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-indigo-400" size={28} />
        </div>
      ) : !thread || thread.posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">이 날짜의 연습 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {thread.posts.map((post) => {
            const rv = reviewStates[post.id] ?? { open: false, comment: "", result: null };
            return (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{post.pieceTitle}</p>
                      <p className="text-sm text-gray-500">{post.practiceCount}회 연습</p>
                    </div>
                    {statusBadge(post.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {post.note && (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{post.note}</p>
                  )}

                  {/* Recordings */}
                  {post.recordings && post.recordings.length > 0 && (
                    <div className="space-y-2">
                      {post.recordings.map((rec) => (
                        <RecordingPlayer
                          key={rec.id}
                          recordingId={rec.id}
                          urlEndpoint="/api/teacher/practice/recordings"
                          durationSec={rec.durationSec}
                          sizeBytes={rec.sizeBytes}
                        />
                      ))}
                    </div>
                  )}

                  {/* Review result */}
                  {post.status === "REVIEWED" && (
                    <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                      post.reviewResult === "OK" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}>
                      {post.reviewResult === "OK" ? (
                        <CheckCircle size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      <span className="font-medium">{post.reviewResult === "OK" ? "합격" : "재연습 필요"}</span>
                      {post.reviewComment && <span>— {post.reviewComment}</span>}
                    </div>
                  )}

                  {/* Review buttons for SUBMITTED posts */}
                  {post.status === "SUBMITTED" && (
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      {!rv.open ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleReview(post.id, "OK")}
                          >
                            <ThumbsUp size={14} />
                            합격
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() =>
                              setReviewStates((p) => ({
                                ...p,
                                [post.id]: { open: true, comment: "", result: "NG" },
                              }))
                            }
                          >
                            <ThumbsDown size={14} />
                            재연습
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-gray-500"
                            onClick={() =>
                              setReviewStates((p) => ({
                                ...p,
                                [post.id]: { open: true, comment: "", result: "OK" },
                              }))
                            }
                          >
                            코멘트 추가
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Textarea
                            value={rv.comment}
                            onChange={(e) =>
                              setReviewStates((p) => ({
                                ...p,
                                [post.id]: { ...rv, comment: e.target.value },
                              }))
                            }
                            placeholder="검토 코멘트 (선택사항)..."
                            className="resize-none h-20 text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white gap-1"
                              onClick={() => handleReview(post.id, rv.result ?? "OK")}
                            >
                              <CheckCircle size={14} />
                              {rv.result === "OK" ? "합격 완료" : "재연습 완료"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setReviewStates((p) => ({ ...p, [post.id]: { open: false, comment: "", result: null } }))}
                            >
                              취소
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comments */}
                  {post.comments && post.comments.length > 0 && (
                    <div className="space-y-2 border-t border-gray-100 pt-2">
                      {post.comments.map((c) => (
                        <div key={c.id} className="flex items-start gap-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs flex-shrink-0">
                            {c.author?.name?.charAt(0) ?? "?"}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium text-gray-800">{c.author?.name ?? "알 수 없음"}</span>
                            <span className="text-xs text-gray-400 ml-1">{c.authorRole}</span>
                            <p className="text-gray-600 mt-0.5">{c.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment button */}
                  <div>
                    <TeacherCommentInput
                      postId={post.id}
                      onSubmit={(body) => handleAddComment(post.id, body, "GENERAL")}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeacherCommentInput({
  postId,
  onSubmit,
}: {
  postId: string;
  onSubmit: (body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setLoading(true);
    await onSubmit(body.trim());
    setBody("");
    setOpen(false);
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-500 hover:text-indigo-700 mt-1"
      >
        + 댓글 달기
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="댓글을 입력하세요..."
        className="resize-none h-16 text-sm"
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={loading || !body.trim()}>
          {loading ? "등록 중..." : "등록"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setBody(""); }}>
          취소
        </Button>
      </div>
    </div>
  );
}
