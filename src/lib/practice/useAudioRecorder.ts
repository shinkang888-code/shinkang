/**
 * useAudioRecorder — React hook wrapping MediaRecorder API
 *
 * Features:
 * - Picks best supported codec: audio/webm;codecs=opus → audio/ogg;codecs=opus → audio/mp4 → audio/webm
 * - Max 90 s hard limit (auto-stops)
 * - iOS Safari fallback (audio/mp4)
 * - Returns blob + metadata on stop
 * - Retry UI on failure
 */

"use client";

import { useState, useRef, useCallback } from "react";

export const MAX_DURATION_SEC = 90;
export const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export type RecordingState = "idle" | "requesting" | "recording" | "stopped" | "error";

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  codec: string;
  durationSec: number;
  sizeBytes: number;
  url: string; // object URL for local preview
}

function getSupportedMimeType(): { mimeType: string; codec: string } {
  const candidates = [
    { mimeType: "audio/webm;codecs=opus", codec: "opus" },
    { mimeType: "audio/webm", codec: "webm" },
    { mimeType: "audio/ogg;codecs=opus", codec: "opus" },
    { mimeType: "audio/ogg", codec: "vorbis" },
    { mimeType: "audio/mp4", codec: "aac" }, // iOS Safari
    { mimeType: "audio/mpeg", codec: "mp3" },
  ];

  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }

  // Fallback: let browser decide
  return { mimeType: "audio/webm", codec: "unknown" };
}

export interface UseAudioRecorderReturn {
  state: RecordingState;
  elapsed: number; // seconds
  result: RecordingResult | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    setElapsed(0);
    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
        video: false,
      });
      streamRef.current = stream;

      const { mimeType, codec } = getSupportedMimeType();

      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        audioBitsPerSecond: 64000,
      });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const durationSec = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        setResult({
          blob,
          mimeType,
          codec,
          durationSec,
          sizeBytes: blob.size,
          url,
        });
        setState("stopped");
        cleanup();
      };

      mr.onerror = () => {
        setError("녹음 중 오류가 발생했습니다.");
        setState("error");
        cleanup();
      };

      mr.start(500); // collect in 500ms chunks
      setState("recording");

      // Tick timer
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(sec);
        if (sec >= MAX_DURATION_SEC) {
          mr.stop();
          clearInterval(timerRef.current!);
          timerRef.current = null;
        }
      }, 500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "마이크 권한이 거부되었습니다."
            : err.message
          : "알 수 없는 오류";
      setError(msg);
      setState("error");
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (result?.url) URL.revokeObjectURL(result.url);
    cleanup();
    setState("idle");
    setElapsed(0);
    setResult(null);
    setError(null);
  }, [cleanup, result]);

  return { state, elapsed, result, error, startRecording, stopRecording, reset };
}

// ─── Upload helper ──────────────────────────────────────────────────────────

export interface UploadOptions {
  postId: string;
  studioId: string;
  recording: RecordingResult;
  onProgress?: (pct: number) => void;
}

export interface UploadResult {
  recordingId: string;
  storageKey: string;
}

export async function uploadRecording(opts: UploadOptions): Promise<UploadResult> {
  const { postId, studioId, recording, onProgress } = opts;

  // 1. Get presigned URL
  const presignRes = await fetch("/api/student/practice/recordings/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postId,
      studioId,
      mimeType: recording.mimeType,
      sizeBytes: recording.sizeBytes,
      durationSec: recording.durationSec,
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Presign failed");
  }

  const { data: presignData } = await presignRes.json();
  const { uploadUrl, storageKey } = presignData as {
    uploadUrl: string;
    storageKey: string;
  };

  onProgress?.(10);

  // 2. PUT to presigned URL (or local proxy)
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": recording.mimeType.split(";")[0] },
    body: recording.blob,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
  }

  onProgress?.(80);

  // 3. Complete — idempotent
  const completeRes = await fetch("/api/student/practice/recordings/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postId,
      studioId,
      storageKey,
      mimeType: recording.mimeType,
      codec: recording.codec,
      durationSec: recording.durationSec,
      sizeBytes: recording.sizeBytes,
    }),
  });

  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Complete failed");
  }

  const { data: completeData } = await completeRes.json();
  onProgress?.(100);

  return {
    recordingId: completeData.id,
    storageKey,
  };
}
