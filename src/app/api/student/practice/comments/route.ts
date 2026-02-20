/**
 * POST /api/student/practice/comments
 * Students can add GENERAL, QUESTION comments (not INSTRUCTION)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { CreateCommentSchema } from "@/lib/schemas/practice";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = CreateCommentSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { threadId, studioId, postId, body: commentBody, type, parentId } = parsed.data;

  // Students cannot create INSTRUCTION or ANSWER comments on their own
  if (type === "INSTRUCTION") {
    return apiError("Students cannot create INSTRUCTION comments", 403);
  }

  // Verify student belongs to this studio
  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id, studioId, isActive: true },
    select: { id: true },
  });
  if (!student) return apiError("Forbidden", 403);

  // Verify thread belongs to student
  const thread = await prisma.practiceThread.findFirst({
    where: { id: threadId, studioId, studentId: student.id },
    select: { id: true },
  });
  if (!thread) return apiError("Thread not found", 404);

  // If parentId given, verify it's a top-level comment (1-depth only)
  if (parentId) {
    const parent = await prisma.practiceComment.findFirst({
      where: { id: parentId, threadId },
      select: { parentId: true },
    });
    if (!parent) return apiError("Parent comment not found", 404);
    if (parent.parentId) return apiError("Only 1-depth replies allowed", 400);
  }

  const comment = await prisma.practiceComment.create({
    data: {
      studioId,
      threadId,
      postId: postId ?? null,
      authorUserId: session!.user.id,
      authorRole: session!.user.role ?? "STUDENT",
      body: commentBody,
      type,
      parentId: parentId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  });

  return apiSuccess(comment, 201);
}
