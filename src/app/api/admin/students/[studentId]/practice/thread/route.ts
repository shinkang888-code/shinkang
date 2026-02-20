/**
 * GET /api/admin/students/[studentId]/practice/thread?date=YYYY-MM-DD
 * Admin/Teacher view of a student's practice thread.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { GetThreadSchema } from "@/lib/schemas/practice";

interface Params {
  params: Promise<{ studentId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { studentId } = await params;

  const { searchParams } = new URL(req.url);
  const parsed = GetThreadSchema.safeParse({ date: searchParams.get("date") });
  if (!parsed.success) return apiError("Invalid parameters", 400, parsed.error.flatten());

  const { date } = parsed.data;

  // Verify admin owns the studio the student belongs to
  const student = await prisma.student.findFirst({
    where: { id: studentId, isActive: true },
    select: { id: true, studioId: true, user: { select: { name: true, email: true } } },
  });
  if (!student) return apiError("Student not found", 404);

  const hasAccess = await prisma.studio.findFirst({
    where: { id: student.studioId, adminId: session!.user.id },
  });
  if (!hasAccess) return apiError("Forbidden", 403);

  // Upsert thread
  const thread = await prisma.practiceThread.upsert({
    where: {
      studioId_studentId_date: {
        studioId: student.studioId,
        studentId,
        date,
      },
    },
    create: {
      studioId: student.studioId,
      studentId,
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

  return apiSuccess({ thread, student: student.user, studioId: student.studioId });
}
