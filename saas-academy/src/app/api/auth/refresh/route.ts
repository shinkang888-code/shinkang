/**
 * POST /api/auth/refresh
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { signAccessToken, parseDurationMs } from "@/lib/auth/jwt";
import { validateAndConsumeSession, createSession } from "@/lib/auth/token-store";
import { setAuthCookies } from "@/lib/auth/cookies";
import { err } from "@/lib/guards/route-guard";

export async function POST(req: NextRequest) {
  let rawToken = req.cookies.get("sa_refresh")?.value ?? null;
  if (!rawToken) {
    try {
      const body = await req.json();
      rawToken = body?.refreshToken ?? null;
    } catch { /* no body */ }
  }

  if (!rawToken) return err("No refresh token", 401);

  const session = await validateAndConsumeSession(rawToken);
  if (!session) return err("Refresh token is invalid, expired, or revoked", 401);

  const user = await prisma.user.findUnique({
    where:  { id: session.userId },
    select: { id: true, role: true, academyId: true, status: true },
  });
  if (!user || user.status === "SUSPENDED") return err("Account is suspended", 403);

  const { refreshToken: newRaw, expiresAt } = await createSession({
    userId:    user.id,
    academyId: user.academyId,
    userAgent: req.headers.get("user-agent") ?? undefined,
    ip:        req.headers.get("x-forwarded-for") ?? "unknown",
  });

  const accessToken   = await signAccessToken({ sub: user.id, role: user.role, academyId: user.academyId });
  const accessMaxAge  = parseDurationMs(process.env.JWT_ACCESS_EXPIRES ?? "15m") / 1000;
  const refreshMaxAge = (expiresAt.getTime() - Date.now()) / 1000;

  const baseRes = NextResponse.json({ data: { accessToken } }, { status: 200 });
  return setAuthCookies(accessToken, newRaw, { accessMaxAge, refreshMaxAge }, baseRes);
}
