/**
 * GET /api/student/practice/recordings/[recordingId]/url
 * Returns a signed playback URL for a recording.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { presignDownload } from "@/lib/storage";

interface Params {
  params: Promise<{ recordingId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { recordingId } = await params;

  // Verify student owns this recording
  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id, isActive: true },
    select: { id: true },
  });
  if (!student) return apiError("Forbidden", 403);

  const recording = await prisma.practiceRecording.findFirst({
    where: { id: recordingId, studentId: student.id },
    select: { storageKey: true, mimeType: true },
  });
  if (!recording) return apiError("Recording not found", 404);

  const { url, expiresIn } = await presignDownload(recording.storageKey);

  return apiSuccess({ url, expiresIn, mimeType: recording.mimeType });
}
