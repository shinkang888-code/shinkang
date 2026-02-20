"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, AlertCircle } from "lucide-react";

interface RecordingPlayerProps {
  recordingId: string;
  urlEndpoint: string; // e.g. "/api/student/practice/recordings" or "/api/admin/practice/recordings"
  durationSec: number;
  sizeBytes: number;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecordingPlayer({
  recordingId,
  urlEndpoint,
  durationSec,
  sizeBytes,
}: RecordingPlayerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadAndPlay = async () => {
    if (signedUrl) {
      // Already loaded — just toggle
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${urlEndpoint}/${recordingId}/url`);
      if (!res.ok) throw new Error("URL 요청 실패");
      const { data } = await res.json();
      setSignedUrl(data.url);
    } catch {
      setError("재생 실패");
    } finally {
      setLoading(false);
    }
  };

  // Auto-play when URL is loaded
  useEffect(() => {
    if (signedUrl && audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [signedUrl]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <Button
        onClick={loadAndPlay}
        size="sm"
        variant="outline"
        disabled={loading}
        className="gap-1 h-7 px-2"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        {isPlaying ? "일시정지" : "재생"}
      </Button>

      <span className="text-gray-400 text-xs">
        {isPlaying
          ? formatTime(currentTime)
          : formatTime(durationSec)}{" "}
        | {(sizeBytes / 1024).toFixed(0)}KB
      </span>

      {error && (
        <span className="text-red-500 text-xs flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </span>
      )}

      {signedUrl && (
        <audio
          ref={audioRef}
          src={signedUrl}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
          className="hidden"
        />
      )}
    </div>
  );
}
