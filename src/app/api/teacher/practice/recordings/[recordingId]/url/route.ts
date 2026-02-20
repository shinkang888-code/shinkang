/**
 * GET /api/teacher/practice/recordings/[recordingId]/url
 * Returns a signed playback URL for a recording (teacher access).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacher, getTeacherStudio, apiSuccess, apiError } from "@/lib/api-helpers";
import { presignDownload } from "@/lib/storage";

interface Params {
  params: Promise<{ recordingId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { error, session } = await requireTeacher();
  if (error) return error;

  const { recordingId } = await params;

  const studio = await getTeacherStudio(session!.user.id);
  if (!studio) return apiError("Forbidden", 403);

  // Verify recording belongs to this studio
  const recording = await prisma.practiceRecording.findFirst({
    where: { id: recordingId, studioId: studio.id },
    select: { storageKey: true, mimeType: true },
  });
  if (!recording) return apiError("Recording not found", 404);

  const { url, expiresIn } = await presignDownload(recording.storageKey);

  return apiSuccess({ url, expiresIn, mimeType: recording.mimeType });
}
