import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 서버 컴포넌트/Route Handler에서 세션 검증
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

/**
 * 관리자 권한 검증
 */
export async function requireAdmin() {
  const { error, session } = await requireAuth();
  if (error || !session) return { error: error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

/**
 * 선생님 권한 검증
 */
export async function requireTeacher() {
  const { error, session } = await requireAuth();
  if (error || !session) return { error: error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  if (session.user.role !== "TEACHER") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

/**
 * 선생님 또는 관리자 권한 검증
 */
export async function requireTeacherOrAdmin() {
  const { error, session } = await requireAuth();
  if (error || !session) return { error: error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

/**
 * 관리자가 특정 studioId에 접근 권한이 있는지 확인
 */
export async function verifyStudioAccess(userId: string, studioId: string) {
  const studio = await prisma.studio.findFirst({
    where: { id: studioId, adminId: userId },
  });
  return !!studio;
}

/**
 * 선생님이 특정 studioId에 접근 권한이 있는지 확인
 */
export async function verifyTeacherStudioAccess(userId: string, studioId: string) {
  const teacher = await prisma.studioTeacher.findFirst({
    where: { userId, studioId, isActive: true },
  });
  return !!teacher;
}

/**
 * 관리자 또는 선생님이 특정 studioId에 접근 권한이 있는지 확인
 */
export async function verifyStudioAccessByRole(userId: string, role: string, studioId: string) {
  if (role === "ADMIN") {
    return verifyStudioAccess(userId, studioId);
  }
  if (role === "TEACHER") {
    return verifyTeacherStudioAccess(userId, studioId);
  }
  return false;
}

/**
 * 원생이 본인 데이터에만 접근하도록 검증
 */
export async function verifyStudentAccess(userId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, userId },
  });
  return !!student;
}

/**
 * 선생님의 스튜디오 정보 가져오기
 */
export async function getTeacherStudio(userId: string) {
  const studioTeacher = await prisma.studioTeacher.findFirst({
    where: { userId, isActive: true },
    include: { studio: true },
  });
  return studioTeacher?.studio ?? null;
}

/**
 * API 응답 헬퍼
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status });
}
