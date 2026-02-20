"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AudioRecorder } from "./AudioRecorder";
import { RecordingPlayer } from "./RecordingPlayer";
import { CommentSection, type CommentData } from "./CommentSection";
import { Music, ChevronDown, ChevronUp, CheckCircle, Clock, Send } from "lucide-react";
import { toast } from "sonner";

export interface RecordingData {
  id: string;
  mimeType: string;
  durationSec: number;
  sizeBytes: number;
  createdAt: string;
}

export interface PostData {
  id: string;
  threadId: string;
  studioId: string;
  studentId: string;
  pieceTitle: string;
  practiceCount: number;
  note: string | null;
  status: "DRAFT" | "SUBMITTED" | "REVIEWED";
  lastRecordingId: string | null;
  reviewResult: "OK" | "NG" | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  recordings: RecordingData[];
  comments: CommentData[];
}

interface PracticePostCardProps {
  post: PostData;
  currentUserId: string;
  currentRole: string;
  threadId: string;
  studioId: string;
  onPostUpdated: (post: PostData) => void;
  commentEndpoint: string;
  recordingUrlEndpoint: string;
  showRecorder?: boolean;
}

function StatusBadge({ status }: { status: PostData["status"] }) {
  if (status === "DRAFT") return <Badge variant="secondary" className="text-xs">초안</Badge>;
  if (status === "SUBMITTED") return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">제출됨</Badge>;
  return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">검토완료</Badge>;
}

export function PracticePostCard({
  post,
  currentUserId,
  currentRole,
  threadId,
  studioId,
  onPostUpdated,
  commentEndpoint,
  recordingUrlEndpoint,
  showRecorder = true,
}: PracticePostCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localPost, setLocalPost] = useState<PostData>(post);

  const isStudent = currentRole === "STUDENT";

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: localPost.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "제출 실패");
      }
      const { data } = await res.json();
      const updated = { ...localPost, status: data.status as PostData["status"] };
      setLocalPost(updated);
      onPostUpdated(updated);
      toast.success("연습 기록이 제출되었습니다!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "제출 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordingUploaded = (recordingId: string) => {
    // Refresh the post to show new recording
    const newRec: RecordingData = {
      id: recordingId,
      mimeType: "audio/webm",
      durationSec: 0,
      sizeBytes: 0,
      createdAt: new Date().toISOString(),
    };
    const updated = {
      ...localPost,
      recordings: [...localPost.recordings, newRec],
      lastRecordingId: recordingId,
    };
    setLocalPost(updated);
    onPostUpdated(updated);
  };

  return (
    <Card className={`border-l-4 ${localPost.status === "REVIEWED" ? "border-l-green-400" : localPost.status === "SUBMITTED" ? "border-l-yellow-400" : "border-l-blue-400"}`}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-blue-100 p-2 flex-shrink-0">
            <Music className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">{localPost.pieceTitle}</h3>
              <StatusBadge status={localPost.status} />
              {localPost.practiceCount > 1 && (
                <Badge variant="outline" className="text-xs">
                  {localPost.practiceCount}회
                </Badge>
              )}
            </div>
            {localPost.note && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">{localPost.note}</p>
            )}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-3">
          {/* Review result */}
          {localPost.status === "REVIEWED" && (
            <div
              className={`rounded-lg p-3 text-sm ${
                localPost.reviewResult === "OK"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 font-medium mb-1">
                <CheckCircle
                  className={`h-4 w-4 ${
                    localPost.reviewResult === "OK" ? "text-green-500" : "text-red-500"
                  }`}
                />
                검토 결과: {localPost.reviewResult === "OK" ? "✅ 합격" : "❌ 재연습 필요"}
              </div>
              {localPost.reviewComment && (
                <p className="text-gray-600">{localPost.reviewComment}</p>
              )}
            </div>
          )}

          {/* Recordings */}
          {localPost.recordings.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium">녹음 파일</p>
              {localPost.recordings.map((rec, i) => (
                <RecordingPlayer
                  key={rec.id}
                  recordingId={rec.id}
                  urlEndpoint={recordingUrlEndpoint}
                  durationSec={rec.durationSec}
                  sizeBytes={rec.sizeBytes}
                />
              ))}
            </div>
          )}

          {/* Audio recorder (students only, non-reviewed posts) */}
          {showRecorder && isStudent && localPost.status !== "REVIEWED" && (
            <AudioRecorder
              postId={localPost.id}
              studioId={studioId}
              onUploaded={handleRecordingUploaded}
            />
          )}

          {/* Submit button */}
          {isStudent && localPost.status === "DRAFT" && (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              size="sm"
              variant="outline"
              className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Send className="h-3 w-3" />
              {submitting ? "제출 중..." : "선생님께 제출"}
            </Button>
          )}

          {localPost.status === "SUBMITTED" && (
            <div className="flex items-center gap-1 text-xs text-yellow-600">
              <Clock className="h-3 w-3" />
              검토 대기 중...
            </div>
          )}

          {/* Comments */}
          <CommentSection
            comments={localPost.comments}
            currentUserId={currentUserId}
            currentRole={currentRole}
            threadId={threadId}
            studioId={studioId}
            postId={localPost.id}
            commentEndpoint={commentEndpoint}
            pinEndpoint={currentRole === "ADMIN" ? "/api/admin/practice/comments" : undefined}
            allowedTypes={
              currentRole === "ADMIN"
                ? ["GENERAL", "INSTRUCTION", "QUESTION", "ANSWER"]
                : ["GENERAL", "QUESTION"]
            }
          />
        </CardContent>
      )}
    </Card>
  );
}
