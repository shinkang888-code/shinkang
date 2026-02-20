/**
 * GET /api/admin/practice/recordings/[recordingId]/url
 * Returns a signed playback URL for any recording in admin's studios.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { presignDownload } from "@/lib/storage";

interface Params {
  params: Promise<{ recordingId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { recordingId } = await params;

  const recording = await prisma.practiceRecording.findFirst({
    where: { id: recordingId },
    include: { studio: { select: { adminId: true } } },
  });
  if (!recording) return apiError("Recording not found", 404);
  if (recording.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  const { url, expiresIn } = await presignDownload(recording.storageKey);

  return apiSuccess({ url, expiresIn, mimeType: recording.mimeType });
}
