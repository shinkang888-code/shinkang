"use client";

import { useAudioRecorder, uploadRecording, MAX_DURATION_SEC, type RecordingResult } from "@/lib/practice/useAudioRecorder";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Mic, Square, Play, Pause, RotateCcw, Upload, Loader2, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

interface AudioRecorderProps {
  postId: string;
  studioId: string;
  onUploaded?: (recordingId: string) => void;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioRecorder({ postId, studioId, onUploaded }: AudioRecorderProps) {
  const { state, elapsed, result, error, startRecording, stopRecording, reset } = useAudioRecorder();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleUpload = async (rec: RecordingResult) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const { recordingId } = await uploadRecording({
        postId,
        studioId,
        recording: rec,
        onProgress: setUploadProgress,
      });
      toast.success("녹음이 업로드되었습니다!");
      onUploaded?.(recordingId);
      reset();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "업로드 실패";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pct = Math.min(100, (elapsed / MAX_DURATION_SEC) * 100);

  return (
    <div className="space-y-3">
      {/* Main controls */}
      {state === "idle" && (
        <Button
          onClick={startRecording}
          size="sm"
          className="bg-red-500 hover:bg-red-600 text-white gap-2"
        >
          <Mic className="h-4 w-4" />
          녹음 시작
        </Button>
      )}

      {state === "requesting" && (
        <Button disabled size="sm" className="gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          마이크 권한 요청 중...
        </Button>
      )}

      {state === "recording" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-sm font-mono text-red-600">
                {formatTime(elapsed)} / {formatTime(MAX_DURATION_SEC)}
              </span>
            </div>
            <Button
              onClick={stopRecording}
              size="sm"
              variant="destructive"
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              중지
            </Button>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      )}

      {state === "stopped" && result && (
        <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex items-center gap-2">
            <Button
              onClick={togglePlay}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "일시정지" : "재생"}
            </Button>
            <span className="text-xs text-gray-500">
              {formatTime(result.durationSec)} | {(result.sizeBytes / 1024).toFixed(1)} KB
            </span>
            <Button
              onClick={reset}
              size="sm"
              variant="ghost"
              className="gap-1 ml-auto text-gray-500"
            >
              <RotateCcw className="h-3 w-3" />
              다시 녹음
            </Button>
          </div>

          <audio
            ref={audioRef}
            src={result.url}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          {uploading ? (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-1" />
              <p className="text-xs text-gray-500">업로드 중... {uploadProgress}%</p>
            </div>
          ) : (
            <Button
              onClick={() => handleUpload(result)}
              size="sm"
              className="gap-2 w-full"
            >
              <Upload className="h-4 w-4" />
              업로드하여 제출
            </Button>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <Button onClick={reset} size="sm" variant="ghost" className="gap-1">
            <RotateCcw className="h-3 w-3" />
            다시 시도
          </Button>
        </div>
      )}
    </div>
  );
}
