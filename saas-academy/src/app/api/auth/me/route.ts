// GET /api/auth/me — return current user from access token
import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromRequest } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, academyId: true, status: true },
    });
    if (!user || user.status === "SUSPENDED") {
      return NextResponse.json({ success: false, error: "Account not found or suspended" }, { status: 401 });
    }
    return NextResponse.json({ success: true, data: user });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
  }
}
