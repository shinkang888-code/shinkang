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
import { CommentSection, type CommentData } from "@/components/practice/CommentSection";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Pin,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquarePlus,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import type { PostData, RecordingData } from "@/components/practice/PracticePostCard";

interface StudentInfo {
  id: string;
  name: string;
  user: { name: string | null; email: string };
}

interface ThreadData {
  id: string;
  date: string;
  studioId: string;
  studentId: string;
  posts: PostData[];
  comments: CommentData[];
}

interface GoalData {
  weekStart: string;
  weekEnd: string;
  weekTargetCount: number;
  actualCount: number;
  achieved: boolean;
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

interface AdminPracticeClientProps {
  studentId: string;
  studioId: string;
  adminId: string;
  student: StudentInfo;
}

export function AdminPracticeClient({
  studentId,
  studioId,
  adminId,
  student,
}: AdminPracticeClientProps) {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [instructionBody, setInstructionBody] = useState("");
  const [postingInstruction, setPostingInstruction] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [newTarget, setNewTarget] = useState(3);
  const [savingGoal, setSavingGoal] = useState(false);

  const weekStart = getWeekMonday(new Date(selectedDate + "T00:00:00Z"));

  const fetchThread = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/students/${studentId}/practice/thread?date=${date}`
        );
        if (!res.ok) throw new Error("불러오기 실패");
        const { data } = await res.json();
        setThread(data.thread);
      } catch {
        toast.error("연습 기록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [studentId]
  );

  const fetchGoal = useCallback(async () => {
    try {
      const ws = getWeekMonday(new Date(selectedDate + "T00:00:00Z"));
      // Use student goal API proxy (admin calls student goal endpoint via admin route)
      const res = await fetch(
        `/api/admin/practice/goal?studioId=${studioId}&studentId=${studentId}`
      );
      if (!res.ok) return;
      const { data } = await res.json();
      // Calculate actual count for week
      const postsRes = await fetch(
        `/api/admin/students/${studentId}/practice/thread?date=${ws}`
      );
      if (postsRes.ok) {
        const { data: td } = await postsRes.json();
        const submittedInWeek = td.thread?.posts?.filter(
          (p: PostData) => p.status === "SUBMITTED" || p.status === "REVIEWED"
        ).length ?? 0;
        setGoal({
          weekStart: ws,
          weekEnd: (() => {
            const d = new Date(ws + "T00:00:00Z");
            d.setUTCDate(d.getUTCDate() + 6);
            return d.toISOString().slice(0, 10);
          })(),
          weekTargetCount: data.goal?.weekTargetCount ?? 3,
          actualCount: submittedInWeek,
          achieved: submittedInWeek >= (data.goal?.weekTargetCount ?? 3),
        });
      }
    } catch {
      // silent
    }
  }, [selectedDate, studioId, studentId]);

  useEffect(() => {
    fetchThread(selectedDate);
  }, [selectedDate, fetchThread]);

  useEffect(() => {
    fetchGoal();
  }, [weekStart, fetchGoal]);

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleReview = async (postId: string, reviewResult: "OK" | "NG", reviewComment?: string) => {
    try {
      const res = await fetch("/api/admin/practice/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, studioId, reviewResult, reviewComment }),
      });
      if (!res.ok) throw new Error("검토 실패");
      const { data } = await res.json();
      setThread((prev) =>
        prev
          ? {
              ...prev,
              posts: prev.posts.map((p) =>
                p.id === postId
                  ? {
                      ...p,
                      status: data.status,
                      reviewResult: data.reviewResult,
                      reviewComment: data.reviewComment,
                      reviewedAt: data.reviewedAt,
                    }
                  : p
              ),
            }
          : prev
      );
      toast.success(reviewResult === "OK" ? "✅ 합격으로 검토 완료!" : "❌ 재연습 필요로 검토 완료!");
    } catch {
      toast.error("검토 처리 실패");
    }
  };

  const handleInstruction = async () => {
    if (!instructionBody.trim() || !thread) return;
    setPostingInstruction(true);
    try {
      const res = await fetch("/api/admin/practice/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          studioId,
          body: instructionBody.trim(),
          type: "INSTRUCTION",
        }),
      });
      if (!res.ok) throw new Error("등록 실패");
      const { data } = await res.json();
      setThread((prev) =>
        prev
          ? { ...prev, comments: [...prev.comments, data] }
          : prev
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
      const res = await fetch("/api/admin/practice/goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId,
          studentId,
          weekTargetCount: newTarget,
          basis: "SUBMISSION",
        }),
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
    setThread((prev) =>
      prev
        ? {
            ...prev,
            comments: prev.comments.map((c) =>
              c.id === commentId ? { ...c, pinned } : c
            ),
          }
        : prev
    );
  };

  const pinnedComments = thread?.comments.filter((c) => c.pinned) ?? [];

  return (
    <div className="space-y-4">
      {/* Student info header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {student.user.name ?? student.name}
          </h2>
          <p className="text-sm text-gray-500">{student.user.email}</p>
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
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    주간 제출 목표 횟수
                  </label>
                  <Select
                    value={String(newTarget)}
                    onValueChange={(v) => setNewTarget(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}회
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSaveGoal} disabled={savingGoal} className="w-full">
                  저장
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Instruction */}
          <Dialog open={instructionOpen} onOpenChange={setInstructionOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
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

      {/* Weekly goal */}
      {goal && (
        <WeeklyGoal
          weekStart={goal.weekStart}
          weekEnd={goal.weekEnd}
          weekTargetCount={goal.weekTargetCount}
          actualCount={goal.actualCount}
          achieved={goal.achieved}
        />
      )}

      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => changeDate(-1)} variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <p className="font-semibold text-sm">{formatDateKo(selectedDate)}</p>
          </div>
          <Button onClick={() => changeDate(1)} variant="ghost" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={() => setSelectedDate(todayString())}
          variant="outline"
          size="sm"
          className="gap-1 h-8"
        >
          <Calendar className="h-3 w-3" />
          오늘
        </Button>
      </div>

      {/* Pinned instructions */}
      {pinnedComments.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-2">
            <Pin className="h-4 w-4 fill-amber-500" />
            핀 고정된 지시사항
          </div>
          {pinnedComments.map((c) => (
            <div key={c.id} className="text-sm text-amber-900 bg-white rounded-lg p-3 border border-amber-100 flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap">{c.body}</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs flex-shrink-0"
                onClick={async () => {
                  const res = await fetch(`/api/admin/practice/comments/${c.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pinned: false }),
                  });
                  if (res.ok) {
                    handlePinToggle(c.id, false);
                    toast.success("핀 해제되었습니다.");
                  }
                }}
              >
                핀 해제
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Posts */}
      {!loading && thread && (
        <div className="space-y-3">
          {thread.posts.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-gray-400">
                <p className="text-sm">이 날짜에 기록된 연습이 없습니다.</p>
              </CardContent>
            </Card>
          )}

          {thread.posts.map((post) => (
            <AdminPostCard
              key={post.id}
              post={post}
              studioId={studioId}
              threadId={thread.id}
              adminId={adminId}
              onReview={handleReview}
              onPinToggle={handlePinToggle}
            />
          ))}

          {/* Thread-level comments */}
          <div className="pt-2">
            <h4 className="text-xs text-gray-500 font-medium mb-2">스레드 댓글</h4>
            <CommentSection
              comments={thread.comments.filter((c) => !c.postId)}
              currentUserId={adminId}
              currentRole="ADMIN"
              threadId={thread.id}
              studioId={studioId}
              commentEndpoint="/api/admin/practice/comments"
              pinEndpoint="/api/admin/practice/comments"
              allowedTypes={["GENERAL", "INSTRUCTION", "QUESTION", "ANSWER"]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Post Card ──────────────────────────────────────────────────────────

interface AdminPostCardProps {
  post: PostData;
  studioId: string;
  threadId: string;
  adminId: string;
  onReview: (postId: string, result: "OK" | "NG", comment?: string) => void;
  onPinToggle: (commentId: string, pinned: boolean) => void;
}

function AdminPostCard({ post, studioId, threadId, adminId, onReview, onPinToggle }: AdminPostCardProps) {
  const [reviewComment, setReviewComment] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);

  return (
    <Card
      className={`border-l-4 ${
        post.status === "REVIEWED"
          ? post.reviewResult === "OK"
            ? "border-l-green-400"
            : "border-l-red-400"
          : post.status === "SUBMITTED"
          ? "border-l-yellow-400"
          : "border-l-gray-300"
      }`}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{post.pieceTitle}</span>
              <StatusBadge status={post.status} reviewResult={post.reviewResult} />
              {post.practiceCount > 1 && (
                <Badge variant="outline" className="text-xs">{post.practiceCount}회</Badge>
              )}
            </div>
            {post.note && <p className="text-xs text-gray-500 mt-0.5">{post.note}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4 space-y-3">
        {/* Recordings */}
        {post.recordings.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium">녹음 파일</p>
            {post.recordings.map((rec) => (
              <RecordingPlayer
                key={rec.id}
                recordingId={rec.id}
                urlEndpoint="/api/admin/practice/recordings"
                durationSec={rec.durationSec}
                sizeBytes={rec.sizeBytes}
              />
            ))}
          </div>
        )}

        {/* Review buttons */}
        {post.status === "SUBMITTED" && (
          <div className="space-y-2">
            {!showReviewForm ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => onReview(post.id, "OK")}
                  size="sm"
                  className="gap-1 bg-green-500 hover:bg-green-600"
                >
                  <CheckCircle className="h-3 w-3" />
                  합격 (OK)
                </Button>
                <Button
                  onClick={() => setShowReviewForm(true)}
                  size="sm"
                  variant="destructive"
                  className="gap-1"
                >
                  <XCircle className="h-3 w-3" />
                  재연습 (NG)
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="재연습 사유를 입력하세요..."
                  className="text-sm resize-none h-16"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      onReview(post.id, "NG", reviewComment);
                      setShowReviewForm(false);
                    }}
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                  >
                    <XCircle className="h-3 w-3" />
                    재연습으로 처리
                  </Button>
                  <Button
                    onClick={() => setShowReviewForm(false)}
                    size="sm"
                    variant="ghost"
                  >
                    취소
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review result display */}
        {post.status === "REVIEWED" && (
          <div
            className={`rounded-lg p-2 text-sm ${
              post.reviewResult === "OK"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <span className="font-medium">
              {post.reviewResult === "OK" ? "✅ 합격" : "❌ 재연습 필요"}
            </span>
            {post.reviewComment && (
              <p className="text-gray-600 mt-1">{post.reviewComment}</p>
            )}
          </div>
        )}

        {/* Comments */}
        <CommentSection
          comments={post.comments}
          currentUserId={adminId}
          currentRole="ADMIN"
          threadId={threadId}
          studioId={studioId}
          postId={post.id}
          commentEndpoint="/api/admin/practice/comments"
          pinEndpoint="/api/admin/practice/comments"
          allowedTypes={["GENERAL", "INSTRUCTION", "QUESTION", "ANSWER"]}
        />
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  status,
  reviewResult,
}: {
  status: PostData["status"];
  reviewResult: PostData["reviewResult"];
}) {
  if (status === "DRAFT") return <Badge variant="secondary" className="text-xs">초안</Badge>;
  if (status === "SUBMITTED") return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">검토 대기</Badge>;
  if (reviewResult === "OK") return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">합격</Badge>;
  return <Badge variant="destructive" className="text-xs">재연습</Badge>;
}
