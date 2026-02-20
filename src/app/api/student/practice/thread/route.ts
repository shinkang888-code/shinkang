/**
 * GET /api/student/practice/thread?date=YYYY-MM-DD
 * Returns (or creates) the PracticeThread for the logged-in student on the given date.
 * Includes posts, recordings, and comments.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { GetThreadSchema } from "@/lib/schemas/practice";

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  // Parse + validate query params
  const { searchParams } = new URL(req.url);
  const parsed = GetThreadSchema.safeParse({ date: searchParams.get("date") });
  if (!parsed.success) return apiError("Invalid parameters", 400, parsed.error.flatten());

  const { date } = parsed.data;

  // Get student record
  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id, isActive: true },
    select: { id: true, studioId: true },
  });
  if (!student) return apiError("Student record not found", 404);

  // Upsert thread (idempotent)
  const thread = await prisma.practiceThread.upsert({
    where: {
      studioId_studentId_date: {
        studioId: student.studioId,
        studentId: student.id,
        date,
      },
    },
    create: {
      studioId: student.studioId,
      studentId: student.id,
      date,
    },
    update: {},
    include: {
      posts: {
        orderBy: { createdAt: "asc" },
        include: {
          recordings: { orderBy: { createdAt: "desc" }, take: 5 },
          comments: {
            where: { parentId: null },
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { id: true, name: true, role: true } },
              replies: {
                orderBy: { createdAt: "asc" },
                include: {
                  author: { select: { id: true, name: true, role: true } },
                },
              },
            },
          },
        },
      },
      comments: {
        where: { postId: null, parentId: null },
        orderBy: [{ pinned: "desc" }, { createdAt: "asc" }],
        include: {
          author: { select: { id: true, name: true, role: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { id: true, name: true, role: true } },
            },
          },
        },
      },
    },
  });

  return apiSuccess({ thread, studentId: student.id, studioId: student.studioId });
}
