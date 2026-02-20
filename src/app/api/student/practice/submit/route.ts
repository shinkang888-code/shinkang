/**
 * POST /api/student/practice/submit
 * Submits a DRAFT post → SUBMITTED (marks it ready for teacher review)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { SubmitPostSchema } from "@/lib/schemas/practice";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = SubmitPostSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { postId } = parsed.data;

  // Verify student owns post
  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id, isActive: true },
    select: { id: true },
  });
  if (!student) return apiError("Forbidden", 403);

  const post = await prisma.practicePost.findFirst({
    where: { id: postId, studentId: student.id },
  });
  if (!post) return apiError("Post not found", 404);
  if (post.status === "REVIEWED") return apiError("Already reviewed", 400);

  const updated = await prisma.practicePost.update({
    where: { id: postId },
    data: { status: "SUBMITTED" },
  });

  return apiSuccess(updated);
}
