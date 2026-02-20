"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pin, Reply, Send, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CommentData {
  id: string;
  authorUserId: string;
  authorRole: string;
  body: string;
  type: "GENERAL" | "INSTRUCTION" | "QUESTION" | "ANSWER";
  pinned: boolean;
  parentId: string | null;
  postId: string | null;
  createdAt: string;
  author: { id: string; name: string | null; role: string };
  replies?: CommentData[];
}

interface CommentItemProps {
  comment: CommentData;
  currentUserId: string;
  currentRole: string;
  threadId: string;
  studioId: string;
  postId?: string;
  onPinToggle?: (commentId: string, pinned: boolean) => void;
  onReply?: (comment: CommentData) => void;
  isReply?: boolean;
  commentEndpoint: string;
  pinEndpoint?: string;
  onCommentAdded: (comment: CommentData) => void;
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    INSTRUCTION: "지시",
    QUESTION: "질문",
    ANSWER: "답변",
    GENERAL: "일반",
  };
  return map[type] ?? type;
}

function typeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  if (type === "INSTRUCTION") return "default";
  if (type === "QUESTION") return "secondary";
  if (type === "ANSWER") return "outline";
  return "outline";
}

function CommentItem({
  comment,
  currentUserId,
  currentRole,
  threadId,
  studioId,
  postId,
  onPinToggle,
  isReply,
  commentEndpoint,
  pinEndpoint,
  onCommentAdded,
}: CommentItemProps) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  const isAdmin = currentRole === "ADMIN";

  const handlePin = async () => {
    if (!pinEndpoint) return;
    setPinLoading(true);
    try {
      const res = await fetch(`${pinEndpoint}/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !comment.pinned }),
      });
      if (!res.ok) throw new Error("실패");
      onPinToggle?.(comment.id, !comment.pinned);
    } catch {
      toast.error("핀 설정 실패");
    } finally {
      setPinLoading(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(commentEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          studioId,
          postId,
          body: replyText.trim(),
          type: "GENERAL",
          parentId: comment.id,
        }),
      });
      if (!res.ok) throw new Error("댓글 등록 실패");
      const { data } = await res.json();
      onCommentAdded(data);
      setReplyText("");
      setShowReplyBox(false);
      toast.success("답글이 등록되었습니다.");
    } catch {
      toast.error("답글 등록 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn("space-y-1", isReply && "ml-6 border-l-2 border-gray-100 pl-3")}>
      <div
        className={cn(
          "rounded-lg p-3 space-y-1",
          comment.pinned ? "bg-amber-50 border border-amber-200" : "bg-gray-50",
          comment.type === "INSTRUCTION" && !comment.pinned && "bg-blue-50"
        )}
      >
        <div className="flex items-center gap-2 text-xs">
          {comment.pinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />}
          <span className="font-medium text-gray-800">{comment.author.name ?? "익명"}</span>
          <Badge variant={typeVariant(comment.type)} className="text-xs py-0 px-1 h-4">
            {typeLabel(comment.type)}
          </Badge>
          <span className="text-gray-400 ml-auto">
            {new Date(comment.createdAt).toLocaleString("ko-KR", {
              month: "numeric",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.body}</p>

        <div className="flex items-center gap-1 pt-1">
          {isAdmin && pinEndpoint && !isReply && (
            <Button
              onClick={handlePin}
              disabled={pinLoading}
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1"
            >
              <Pin className="h-3 w-3" />
              {comment.pinned ? "핀 해제" : "핀 고정"}
            </Button>
          )}
          {!isReply && (
            <Button
              onClick={() => setShowReplyBox(!showReplyBox)}
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1"
            >
              <Reply className="h-3 w-3" />
              답글
            </Button>
          )}
        </div>
      </div>

      {/* Reply box */}
      {showReplyBox && (
        <div className="ml-6 flex gap-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="답글을 입력하세요..."
            className="text-sm resize-none h-16"
          />
          <div className="flex flex-col gap-1">
            <Button
              onClick={handleReplySubmit}
              disabled={submitting || !replyText.trim()}
              size="sm"
              className="h-8"
            >
              <Send className="h-3 w-3" />
            </Button>
            <Button
              onClick={() => setShowReplyBox(false)}
              size="sm"
              variant="ghost"
              className="h-8"
            >
              취소
            </Button>
          </div>
        </div>
      )}

      {/* Replies */}
      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          currentUserId={currentUserId}
          currentRole={currentRole}
          threadId={threadId}
          studioId={studioId}
          postId={postId}
          isReply
          commentEndpoint={commentEndpoint}
          pinEndpoint={pinEndpoint}
          onCommentAdded={onCommentAdded}
          onPinToggle={onPinToggle}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface CommentSectionProps {
  comments: CommentData[];
  currentUserId: string;
  currentRole: string;
  threadId: string;
  studioId: string;
  postId?: string;
  commentEndpoint: string;
  pinEndpoint?: string;
  allowedTypes?: Array<"GENERAL" | "INSTRUCTION" | "QUESTION" | "ANSWER">;
}

export function CommentSection({
  comments: initialComments,
  currentUserId,
  currentRole,
  threadId,
  studioId,
  postId,
  commentEndpoint,
  pinEndpoint,
  allowedTypes = ["GENERAL", "QUESTION"],
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);
  const [expanded, setExpanded] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [newType, setNewType] = useState<"GENERAL" | "INSTRUCTION" | "QUESTION" | "ANSWER">(
    allowedTypes[0]
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(commentEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          studioId,
          postId,
          body: newBody.trim(),
          type: newType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "댓글 등록 실패");
      }
      const { data } = await res.json();
      setComments((prev) => [...prev, data]);
      setNewBody("");
      setShowForm(false);
      toast.success("댓글이 등록되었습니다.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "댓글 등록 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentAdded = (comment: CommentData) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === comment.parentId) {
          return { ...c, replies: [...(c.replies ?? []), comment] };
        }
        return c;
      })
    );
  };

  const handlePinToggle = (commentId: string, pinned: boolean) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, pinned } : c))
    );
  };

  const topComments = comments.filter((c) => !c.parentId);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        댓글 {topComments.length}개
      </button>

      {expanded && (
        <>
          <div className="space-y-2">
            {topComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                currentRole={currentRole}
                threadId={threadId}
                studioId={studioId}
                postId={postId}
                commentEndpoint={commentEndpoint}
                pinEndpoint={pinEndpoint}
                onCommentAdded={handleCommentAdded}
                onPinToggle={handlePinToggle}
              />
            ))}
          </div>

          {!showForm ? (
            <Button
              onClick={() => setShowForm(true)}
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
            >
              + 댓글 추가
            </Button>
          ) : (
            <div className="space-y-2">
              {allowedTypes.length > 1 && (
                <div className="flex gap-1">
                  {allowedTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs border",
                        newType === t
                          ? "bg-blue-600 text-white border-blue-600"
                          : "text-gray-500 border-gray-200"
                      )}
                    >
                      {typeLabel(t)}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="댓글을 입력하세요..."
                className="text-sm resize-none h-20"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !newBody.trim()}
                  size="sm"
                  className="gap-1"
                >
                  <Send className="h-3 w-3" />
                  {submitting ? "등록 중..." : "등록"}
                </Button>
                <Button
                  onClick={() => {
                    setShowForm(false);
                    setNewBody("");
                  }}
                  size="sm"
                  variant="ghost"
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
