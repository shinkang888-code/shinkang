/**
 * POST /api/student/practice/recordings/presign
 * Returns a presigned PUT URL for uploading a recording.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { PresignSchema } from "@/lib/schemas/practice";
import { presignUpload } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = PresignSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { postId, studioId, mimeType, sizeBytes, durationSec } = parsed.data;

  // Verify student owns this post
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

  try {
    const result = await presignUpload({
      studioId,
      studentId: student.id,
      mimeType,
      sizeBytes,
      durationSec,
    });

    return apiSuccess(result, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Presign failed";
    return apiError(msg, 400);
  }
}
