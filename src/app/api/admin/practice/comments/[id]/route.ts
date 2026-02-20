/**
 * PATCH /api/admin/practice/comments/[id]
 * Toggle pin status of a comment. Only admins can pin/unpin.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { PinCommentSchema } from "@/lib/schemas/practice";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON", 400);

  const parsed = PinCommentSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  // Verify comment belongs to admin's studio
  const comment = await prisma.practiceComment.findFirst({
    where: { id },
    include: { studio: { select: { adminId: true } } },
  });
  if (!comment) return apiError("Comment not found", 404);
  if (comment.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  const updated = await prisma.practiceComment.update({
    where: { id },
    data: { pinned: parsed.data.pinned },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  });

  return apiSuccess(updated);
}
