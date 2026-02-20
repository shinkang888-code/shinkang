import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

interface Params {
  params: Promise<{ studentId: string }>;
}

const updateSchema = z.object({
  grade: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  memo: z.string().optional(),
  isActive: z.boolean().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
});

// GET /api/admin/students/[studentId]
export async function GET(_req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { studentId } = await params;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, profileImage: true } },
      studio: { select: { id: true, name: true, adminId: true } },
      lessonSchedules: {
        orderBy: { startAt: "desc" },
        take: 10,
        include: { lesson: { select: { title: true, color: true } } },
      },
      payments: { orderBy: { billingMonth: "desc" }, take: 6 },
      _count: { select: { practiceSessions: true } },
    },
  });

  if (!student) return apiError("Student not found", 404);
  if (student.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  return apiSuccess(student);
}

// PATCH /api/admin/students/[studentId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { studentId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { studio: true },
  });
  if (!student) return apiError("Student not found", 404);
  if (student.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  const { name, phone, ...studentFields } = parsed.data;

  // User 정보 업데이트
  if (name || phone) {
    await prisma.user.update({
      where: { id: student.userId },
      data: { ...(name && { name }), ...(phone && { phone }) },
    });
  }

  const updated = await prisma.student.update({
    where: { id: studentId },
    data: studentFields,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  return apiSuccess(updated);
}

// DELETE /api/admin/students/[studentId] — 소프트 삭제
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { studentId } = await params;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { studio: true },
  });
  if (!student) return apiError("Student not found", 404);
  if (student.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  await prisma.student.update({
    where: { id: studentId },
    data: { isActive: false },
  });

  return apiSuccess({ message: "Student deactivated" });
}
