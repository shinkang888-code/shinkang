// DELETE /api/admin/teachers/[teacherId] - 선생님 삭제/비활성화
// PATCH /api/admin/teachers/[teacherId] - 선생님 활성/비활성 토글
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyStudioAccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { teacherId } = await params;
  const body = await req.json();
  const { isActive } = z.object({ isActive: z.boolean() }).parse(body);

  const studioTeacher = await prisma.studioTeacher.findUnique({
    where: { id: teacherId },
    include: { studio: true },
  });

  if (!studioTeacher) {
    return NextResponse.json({ success: false, error: "선생님을 찾을 수 없습니다." }, { status: 404 });
  }

  const hasAccess = await verifyStudioAccess(session!.user.id, studioTeacher.studioId);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
  }

  const updated = await prisma.studioTeacher.update({
    where: { id: teacherId },
    data: { isActive },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, profileImage: true } },
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { teacherId } = await params;

  const studioTeacher = await prisma.studioTeacher.findUnique({
    where: { id: teacherId },
  });

  if (!studioTeacher) {
    return NextResponse.json({ success: false, error: "선생님을 찾을 수 없습니다." }, { status: 404 });
  }

  const hasAccess = await verifyStudioAccess(session!.user.id, studioTeacher.studioId);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
  }

  await prisma.studioTeacher.delete({ where: { id: teacherId } });

  return NextResponse.json({ success: true, data: { deleted: true } });
}
