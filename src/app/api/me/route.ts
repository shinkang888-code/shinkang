import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/me — 현재 로그인 사용자 정보
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    image: session.user.image,
  });
}
