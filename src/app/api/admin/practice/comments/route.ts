/**
 * POST /api/admin/practice/comments
 * Admin/Teacher can create GENERAL, INSTRUCTION, QUESTION, ANSWER comments.
 * Only INSTRUCTION-type comments can be pinned on creation.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { CreateCommentSchema } from "@/lib/schemas/practice";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = CreateCommentSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { threadId, studioId, postId, body: commentBody, type, parentId } = parsed.data;

  // Verify admin owns this studio
  const studio = await prisma.studio.findFirst({
    where: { id: studioId, adminId: session!.user.id },
  });
  if (!studio) return apiError("Forbidden", 403);

  // Verify thread belongs to this studio
  const thread = await prisma.practiceThread.findFirst({
    where: { id: threadId, studioId },
    select: { id: true },
  });
  if (!thread) return apiError("Thread not found", 404);

  // Verify parent depth
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
      authorRole: "ADMIN",
      body: commentBody,
      type,
      pinned: type === "INSTRUCTION", // auto-pin instruction comments
      parentId: parentId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  });

  return apiSuccess(comment, 201);
}
