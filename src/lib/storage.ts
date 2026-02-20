/**
 * Storage utility — supports S3/R2/Supabase via AWS SDK presigned URLs.
 * Set STORAGE_LOCAL_MODE=true for local dev (stores files in /tmp/practice-recordings/).
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import fs from "fs";

// ─── Config ────────────────────────────────────────────────────────────────

const LOCAL_MODE = process.env.STORAGE_LOCAL_MODE === "true";
const LOCAL_DIR = "/tmp/practice-recordings";

const s3 = LOCAL_MODE
  ? null
  : new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT,
      region: process.env.STORAGE_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "",
      },
      forcePathStyle: true, // needed for MinIO / Supabase
    });

const BUCKET = process.env.STORAGE_BUCKET ?? "piano-practice";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PresignResult {
  uploadUrl: string;
  storageKey: string;
  expiresIn: number; // seconds
}

export interface PresignGetResult {
  url: string;
  expiresIn: number;
}

// ─── Allowed MIME types & limits ────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
] as const;

export const MAX_DURATION_SEC = 90;
export const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeContentType(mimeType: string): string {
  // Strip codec parameters for S3 content-type header
  return mimeType.split(";")[0].trim();
}

function getExtension(mimeType: string): string {
  const base = normalizeContentType(mimeType);
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
  };
  return map[base] ?? "bin";
}

function buildKey(studioId: string, studentId: string, filename: string): string {
  return `studios/${studioId}/students/${studentId}/practice/${filename}`;
}

// ─── Presign Upload ──────────────────────────────────────────────────────────

export async function presignUpload(params: {
  studioId: string;
  studentId: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
}): Promise<PresignResult> {
  const { studioId, studentId, mimeType, sizeBytes, durationSec } = params;

  // Validation
  const baseMime = normalizeContentType(mimeType);
  if (!ALLOWED_MIME_TYPES.some((m) => m.startsWith(baseMime))) {
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
  if (sizeBytes > MAX_SIZE_BYTES) {
    throw new Error(`File too large: ${sizeBytes} bytes (max ${MAX_SIZE_BYTES})`);
  }
  if (durationSec > MAX_DURATION_SEC) {
    throw new Error(`Duration too long: ${durationSec}s (max ${MAX_DURATION_SEC}s)`);
  }

  const ext = getExtension(mimeType);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storageKey = buildKey(studioId, studentId, filename);

  if (LOCAL_MODE) {
    // Local dev: return a fake presign URL that points to our upload proxy
    return {
      uploadUrl: `/api/student/practice/recordings/local-upload?key=${encodeURIComponent(storageKey)}`,
      storageKey,
      expiresIn: 300,
    };
  }

  // Real S3 presign
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
    ContentType: normalizeContentType(mimeType),
    ContentLength: sizeBytes,
    Metadata: {
      studioId,
      studentId,
      durationSec: String(durationSec),
    },
  });

  const uploadUrl = await getSignedUrl(s3!, command, { expiresIn: 300 });

  return { uploadUrl, storageKey, expiresIn: 300 };
}

// ─── Presign Download ────────────────────────────────────────────────────────

export async function presignDownload(storageKey: string): Promise<PresignGetResult> {
  if (LOCAL_MODE) {
    return {
      url: `/api/student/practice/recordings/local-download?key=${encodeURIComponent(storageKey)}`,
      expiresIn: 3600,
    };
  }

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: storageKey });
  const url = await getSignedUrl(s3!, command, { expiresIn: 3600 });
  return { url, expiresIn: 3600 };
}

// ─── Local file helpers (dev only) ──────────────────────────────────────────

export function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_DIR)) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
  }
}

export function localFilePath(storageKey: string): string {
  // Flatten key path into a safe filename
  const safe = storageKey.replace(/\//g, "__");
  return path.join(LOCAL_DIR, safe);
}
