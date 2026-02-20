/**
 * POST /api/admin/practice/review
 * Admin reviews a submitted PracticePost: set reviewResult OK|NG + optional comment.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { ReviewPostSchema } from "@/lib/schemas/practice";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = ReviewPostSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { postId, studioId, reviewResult, reviewComment } = parsed.data;

  // Verify admin owns studio
  const studio = await prisma.studio.findFirst({
    where: { id: studioId, adminId: session!.user.id },
  });
  if (!studio) return apiError("Forbidden", 403);

  const post = await prisma.practicePost.findFirst({
    where: { id: postId, studioId },
  });
  if (!post) return apiError("Post not found", 404);
  if (post.status !== "SUBMITTED") return apiError("Post is not in SUBMITTED state", 400);

  const updated = await prisma.practicePost.update({
    where: { id: postId },
    data: {
      status: "REVIEWED",
      reviewResult,
      reviewComment: reviewComment ?? null,
      reviewedByUserId: session!.user.id,
      reviewedAt: new Date(),
    },
  });

  return apiSuccess(updated);
}
