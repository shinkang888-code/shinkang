import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, verifyStudioAccess, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

const createStudentSchema = z.object({
  studioId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  grade: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  memo: z.string().optional(),
});

// GET /api/admin/students?studioId=xxx
export async function GET(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const studioId = searchParams.get("studioId");

  if (!studioId) return apiError("studioId is required");

  const hasAccess = await verifyStudioAccess(session!.user.id, studioId);
  if (!hasAccess) return apiError("Forbidden", 403);

  const students = await prisma.student.findMany({
    where: { studioId, isActive: true },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profileImage: true,
        },
      },
      _count: {
        select: {
          lessonSchedules: true,
          payments: true,
          practiceSessions: true,
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return apiSuccess(students);
}

// POST /api/admin/students — 원생 초대/등록
export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { studioId, name, email, phone, grade, parentName, parentPhone, memo } = parsed.data;

  const hasAccess = await verifyStudioAccess(session!.user.id, studioId);
  if (!hasAccess) return apiError("Forbidden", 403);

  // 이미 존재하는 유저 확인
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // 임시 비밀번호 (원생이 직접 변경해야 함)
    const bcrypt = await import("bcryptjs");
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(tempPassword, 12);

    user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        password: hashed,
        role: "STUDENT",
      },
    });
  }

  // 이미 이 학원에 등록된 원생인지 확인
  const existingStudent = await prisma.student.findFirst({
    where: { userId: user.id, studioId },
  });
  if (existingStudent) return apiError("이미 등록된 원생입니다.", 409);

  const student = await prisma.student.create({
    data: {
      userId: user.id,
      studioId,
      grade,
      parentName,
      parentPhone,
      memo,
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  return apiSuccess(student, 201);
}
