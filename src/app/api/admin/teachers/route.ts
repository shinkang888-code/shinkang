// GET /api/admin/teachers - 선생님 목록
// POST /api/admin/teachers - 새 선생님 초대/생성
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyStudioAccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const CreateTeacherSchema = z.object({
  studioId: z.string(),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다."),
  email: z.string().email("유효한 이메일을 입력하세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  phone: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const studioId = req.nextUrl.searchParams.get("studioId");
  if (!studioId) {
    return NextResponse.json({ success: false, error: "studioId is required" }, { status: 400 });
  }

  const hasAccess = await verifyStudioAccess(session!.user.id, studioId);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
  }

  const teachers = await prisma.studioTeacher.findMany({
    where: { studioId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profileImage: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ success: true, data: teachers });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = CreateTeacherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const hasAccess = await verifyStudioAccess(session!.user.id, parsed.data.studioId);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existingUser) {
    // If user exists and is already a teacher in this studio, error
    const existingTeacher = await prisma.studioTeacher.findFirst({
      where: { studioId: parsed.data.studioId, userId: existingUser.id },
    });
    if (existingTeacher) {
      return NextResponse.json({ success: false, error: "이미 등록된 선생님입니다." }, { status: 409 });
    }
    // If user exists but role isn't TEACHER, update role
    if (existingUser.role !== "TEACHER") {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: "TEACHER" },
      });
    }
    // Add to studio
    const studioTeacher = await prisma.studioTeacher.create({
      data: {
        studioId: parsed.data.studioId,
        userId: existingUser.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, profileImage: true } },
      },
    });
    return NextResponse.json({ success: true, data: studioTeacher }, { status: 201 });
  }

  // Create new user with TEACHER role
  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  const newUser = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      phone: parsed.data.phone,
      role: "TEACHER",
    },
  });

  const studioTeacher = await prisma.studioTeacher.create({
    data: {
      studioId: parsed.data.studioId,
      userId: newUser.id,
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, profileImage: true } },
    },
  });

  return NextResponse.json({ success: true, data: studioTeacher }, { status: 201 });
}
