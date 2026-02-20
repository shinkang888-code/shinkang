"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WeeklyGoal } from "@/components/practice/WeeklyGoal";
import { PracticePostCard, type PostData } from "@/components/practice/PracticePostCard";
import { CommentSection, type CommentData } from "@/components/practice/CommentSection";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Pin,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface GoalData {
  weekStart: string;
  weekEnd: string;
  weekTargetCount: number;
  actualCount: number;
  achieved: boolean;
  basis: string;
}

interface ThreadData {
  id: string;
  date: string;
  studioId: string;
  studentId: string;
  posts: PostData[];
  comments: CommentData[];
}

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

interface StudentPracticeClientProps {
  userId: string;
  userName: string;
  userRole: string;
}

export function StudentPracticeClient({ userId, userName, userRole }: StudentPracticeClientProps) {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [studioId, setStudioId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newPiece, setNewPiece] = useState("");
  const [newCount, setNewCount] = useState(1);
  const [newNote, setNewNote] = useState("");
  const [creating, setCreating] = useState(false);

  const weekStart = getWeekMonday(new Date(selectedDate + "T00:00:00Z"));

  const fetchThread = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/student/practice/thread?date=${date}`);
      if (!res.ok) throw new Error("불러오기 실패");
      const { data } = await res.json();
      setThread(data.thread);
      setStudioId(data.studioId);
      setStudentId(data.studentId);
    } catch {
      toast.error("연습 기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGoal = useCallback(async (weekStartDate: string) => {
    try {
      const res = await fetch(`/api/student/practice/goal?weekStart=${weekStartDate}`);
      if (!res.ok) return;
      const { data } = await res.json();
      setGoal(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchThread(selectedDate);
  }, [selectedDate, fetchThread]);

  useEffect(() => {
    fetchGoal(weekStart);
  }, [weekStart, fetchGoal]);

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleCreatePost = async () => {
    if (!newPiece.trim() || !thread) return;
    setCreating(true);
    try {
      const res = await fetch("/api/student/practice/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          studioId,
          pieceTitle: newPiece.trim(),
          practiceCount: newCount,
          note: newNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "생성 실패");
      }
      const { data } = await res.json();
      const newPost: PostData = {
        ...data,
        recordings: [],
        comments: [],
      };
      setThread((prev) =>
        prev ? { ...prev, posts: [...prev.posts, newPost] } : prev
      );
      setNewPiece("");
      setNewCount(1);
      setNewNote("");
      setNewPostOpen(false);
      toast.success("연습 기록이 추가되었습니다!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const handlePostUpdated = (updated: PostData) => {
    setThread((prev) =>
      prev
        ? {
            ...prev,
            posts: prev.posts.map((p) => (p.id === updated.id ? updated : p)),
          }
        : prev
    );
    // Refresh goal if submitted
    if (updated.status === "SUBMITTED") {
      fetchGoal(weekStart);
    }
  };

  const pinnedComments = thread?.comments.filter((c) => c.pinned) ?? [];
  const threadComments = thread?.comments ?? [];

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => changeDate(-1)} variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-sm">{formatDateKo(selectedDate)}</p>
            {selectedDate === todayString() && (
              <span className="text-xs text-blue-600">오늘</span>
            )}
          </div>
          <Button
            onClick={() => changeDate(1)}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={selectedDate >= todayString()}
          >
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

      {/* Pinned instructions (from teacher) */}
      {pinnedComments.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-2">
            <Pin className="h-4 w-4 fill-amber-500" />
            선생님 지시사항
          </div>
          {pinnedComments.map((c) => (
            <div key={c.id} className="text-sm text-amber-900 bg-white rounded-lg p-3 border border-amber-100">
              <p className="font-medium text-xs text-amber-600 mb-1">
                {c.author.name} · {new Date(c.createdAt).toLocaleDateString("ko-KR")}
              </p>
              <p className="whitespace-pre-wrap">{c.body}</p>
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

      {/* Posts timeline */}
      {!loading && thread && (
        <div className="space-y-3">
          {thread.posts.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-gray-400">
                <p className="text-sm">오늘 연습한 곡을 기록해보세요!</p>
              </CardContent>
            </Card>
          )}

          {thread.posts.map((post) => (
            <PracticePostCard
              key={post.id}
              post={post}
              currentUserId={userId}
              currentRole={userRole}
              threadId={thread.id}
              studioId={studioId}
              onPostUpdated={handlePostUpdated}
              commentEndpoint="/api/student/practice/comments"
              recordingUrlEndpoint="/api/student/practice/recordings"
              showRecorder
            />
          ))}

          {/* Thread-level comments */}
          {threadComments.length > 0 || true ? (
            <div className="pt-2">
              <h4 className="text-xs text-gray-500 font-medium mb-2">스레드 댓글</h4>
              <CommentSection
                comments={threadComments.filter((c) => !c.postId)}
                currentUserId={userId}
                currentRole={userRole}
                threadId={thread.id}
                studioId={studioId}
                commentEndpoint="/api/student/practice/comments"
                allowedTypes={["GENERAL", "QUESTION"]}
              />
            </div>
          ) : null}

          {/* Add new post button */}
          <Dialog open={newPostOpen} onOpenChange={setNewPostOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2 border-dashed">
                <Plus className="h-4 w-4" />
                연습 곡 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 연습 기록 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">곡 제목 *</label>
                  <Input
                    value={newPiece}
                    onChange={(e) => setNewPiece(e.target.value)}
                    placeholder="예: 체르니 30번, 소나티네 1번..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">연습 횟수</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={newCount}
                    onChange={(e) => setNewCount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">메모</label>
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="어려웠던 부분, 느낀 점 등..."
                    className="resize-none h-24"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreatePost}
                    disabled={creating || !newPiece.trim()}
                    className="flex-1"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    추가하기
                  </Button>
                  <Button
                    onClick={() => setNewPostOpen(false)}
                    variant="ghost"
                  >
                    취소
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
