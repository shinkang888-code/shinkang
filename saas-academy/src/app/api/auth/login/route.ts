/**
 * POST /api/auth/login
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, parseDurationMs } from "@/lib/auth/jwt";
import { createSession } from "@/lib/auth/token-store";
import { setAuthCookies } from "@/lib/auth/cookies";
import { audit } from "@/lib/auth/audit";
import { loginSchema } from "@/lib/validators/auth";
import { parseBody, err } from "@/lib/guards/route-guard";

const GENERIC_ERROR = "Invalid email or password";

export async function POST(req: NextRequest) {
  const body = await parseBody(req, loginSchema);
  if (body instanceof Response) return body;

  const { email, password } = body;
  const ip        = req.headers.get("x-forwarded-for") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? undefined;

  const user = await prisma.user.findUnique({
    where:   { email },
    include: { academy: { select: { status: true } } },
  });
  if (!user) return err(GENERIC_ERROR, 401);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return err(GENERIC_ERROR, 401);

  if (user.status === "SUSPENDED") return err("Account is suspended", 403);
  if (user.academy && user.academy.status === "SUSPENDED") return err("Academy is suspended", 403);

  const { refreshToken, expiresAt } = await createSession({
    userId:    user.id,
    academyId: user.academyId,
    userAgent,
    ip,
  });

  const accessToken   = await signAccessToken({ sub: user.id, role: user.role, academyId: user.academyId });
  const accessMaxAge  = parseDurationMs(process.env.JWT_ACCESS_EXPIRES ?? "15m") / 1000;
  const refreshMaxAge = (expiresAt.getTime() - Date.now()) / 1000;

  await audit({
    actorUserId: user.id,
    academyId:   user.academyId,
    action:      "user.login",
    targetType:  "User",
    targetId:    user.id,
    ip,
  });

  const data = { id: user.id, name: user.name, email: user.email, role: user.role, academyId: user.academyId, accessToken };
  const baseRes = NextResponse.json({ data }, { status: 200 });
  return setAuthCookies(accessToken, refreshToken, { accessMaxAge, refreshMaxAge }, baseRes);
}
