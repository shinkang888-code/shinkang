/**
 * POST /api/student/practice/recordings/complete
 * Idempotent: confirms upload finished and stores the PracticeRecording record.
 * Also updates the post's lastRecordingId.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { CompleteRecordingSchema } from "@/lib/schemas/practice";
import { ALLOWED_MIME_TYPES, MAX_DURATION_SEC, MAX_SIZE_BYTES } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = CompleteRecordingSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { postId, studioId, storageKey, mimeType, codec, durationSec, sizeBytes } = parsed.data;

  // Server-side re-validation
  const baseMime = mimeType.split(";")[0].trim();
  if (!ALLOWED_MIME_TYPES.some((m) => m.startsWith(baseMime))) {
    return apiError(`Unsupported MIME type: ${mimeType}`, 400);
  }
  if (sizeBytes > MAX_SIZE_BYTES) return apiError("File too large", 400);
  if (durationSec > MAX_DURATION_SEC) return apiError("Duration too long", 400);

  // Verify student
  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id, studioId, isActive: true },
    select: { id: true },
  });
  if (!student) return apiError("Forbidden", 403);

  const post = await prisma.practicePost.findFirst({
    where: { id: postId, studentId: student.id, studioId },
    select: { id: true },
  });
  if (!post) return apiError("Post not found", 404);

  // Idempotent: upsert by storageKey
  const existing = await prisma.practiceRecording.findFirst({
    where: { studioId, storageKey },
  });

  let recording;
  if (existing) {
    recording = existing; // already completed
  } else {
    recording = await prisma.practiceRecording.create({
      data: {
        postId,
        studioId,
        studentId: student.id,
        storageKey,
        mimeType,
        codec: codec ?? null,
        durationSec,
        sizeBytes,
      },
    });

    // Update lastRecordingId on post
    await prisma.practicePost.update({
      where: { id: postId },
      data: { lastRecordingId: recording.id },
    });
  }

  return apiSuccess(recording, 201);
}
