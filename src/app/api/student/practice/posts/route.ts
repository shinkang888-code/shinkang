/**
 * POST /api/student/practice/posts  — create a new PracticePost
 * PATCH /api/student/practice/posts — update post (pieceTitle, practiceCount, note)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { CreatePostSchema } from "@/lib/schemas/practice";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = CreatePostSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { threadId, studioId, pieceTitle, practiceCount, note } = parsed.data;

  // Verify student owns this thread
  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id, studioId, isActive: true },
    select: { id: true },
  });
  if (!student) return apiError("Forbidden", 403);

  const thread = await prisma.practiceThread.findFirst({
    where: { id: threadId, studioId, studentId: student.id },
    select: { id: true },
  });
  if (!thread) return apiError("Thread not found", 404);

  const post = await prisma.practicePost.create({
    data: {
      threadId,
      studioId,
      studentId: student.id,
      pieceTitle,
      practiceCount,
      note,
    },
  });

  return apiSuccess(post, 201);
}

const PatchSchema = z.object({
  postId: z.string().min(1),
  pieceTitle: z.string().min(1).max(100).optional(),
  practiceCount: z.number().int().min(1).max(50).optional(),
  note: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { postId, ...updates } = parsed.data;

  // Verify student owns this post
  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id, isActive: true },
    select: { id: true },
  });
  if (!student) return apiError("Forbidden", 403);

  const post = await prisma.practicePost.findFirst({
    where: { id: postId, studentId: student.id, status: "DRAFT" },
  });
  if (!post) return apiError("Post not found or not editable", 404);

  const updated = await prisma.practicePost.update({
    where: { id: postId },
    data: updates,
  });

  return apiSuccess(updated);
}
