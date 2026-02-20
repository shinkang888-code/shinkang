/**
 * POST /api/auth/logout
 */
import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/auth/token-store";
import { clearAuthCookies } from "@/lib/auth/cookies";

export async function POST(req: NextRequest) {
  let rawToken: string | null = req.cookies.get("sa_refresh")?.value ?? null;
  if (!rawToken) {
    try {
      const body = await req.json();
      rawToken = body?.refreshToken ?? null;
    } catch { /* no body */ }
  }

  if (rawToken) {
    await revokeSession(rawToken);
  }

  const baseRes = NextResponse.json({ data: { message: "Logged out" } }, { status: 200 });
  return clearAuthCookies(baseRes);
}
