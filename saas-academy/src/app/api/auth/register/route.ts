/**
 * POST /api/auth/register
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken, parseDurationMs } from "@/lib/auth/jwt";
import { createSession } from "@/lib/auth/token-store";
import { setAuthCookies } from "@/lib/auth/cookies";
import { registerSchema } from "@/lib/validators/auth";
import { rateLimit, rateLimitKey } from "@/lib/auth/rate-limit";
import { writeAuditLog } from "@/lib/services/audit.service";

export async function POST(req: NextRequest) {
  // Rate limit
  const allowed = rateLimit(
    rateLimitKey(req, "register"),
    Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 5),
    Number(process.env.RATE_LIMIT_WINDOW_MS    ?? 60_000),
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 },
    );
  }

  const rawBody = await req.json().catch(() => null);
  const parsed  = registerSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, password, academyCode, inviteToken } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? undefined;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  let academyId: string;
  let role: "ADMIN" | "TEACHER" | "STUDENT";

  if (inviteToken) {
    const tokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");
    const invite    = await prisma.invite.findUnique({ where: { tokenHash } });

    if (!invite)        return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    if (invite.usedAt)  return NextResponse.json({ error: "Invite already used" }, { status: 400 });
    if (invite.expiresAt < new Date()) return NextResponse.json({ error: "Invite has expired" }, { status: 400 });

    const academy = await prisma.academy.findUnique({ where: { id: invite.academyId } });
    if (!academy || academy.status === "SUSPENDED") {
      return NextResponse.json({ error: "Academy is suspended" }, { status: 403 });
    }

    academyId = invite.academyId;
    role      = invite.role as "ADMIN" | "TEACHER";

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { name, email, passwordHash, role, academyId, status: "ACTIVE" },
      });
      await tx.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
      return u;
    });

    await writeAuditLog({ actorUserId: user.id, academyId, action: "user.register_invite", targetType: "User", targetId: user.id, ip });

    const { refreshToken, expiresAt } = await createSession({ userId: user.id, academyId, ip, userAgent: req.headers.get("user-agent") ?? undefined });
    const accessToken   = await signAccessToken({ sub: user.id, role, academyId });
    const accessMaxAge  = parseDurationMs(process.env.JWT_ACCESS_EXPIRES ?? "15m") / 1000;
    const refreshMaxAge = (expiresAt.getTime() - Date.now()) / 1000;

    const data = { id: user.id, name: user.name, email: user.email, role, academyId, accessToken };
    const baseRes = NextResponse.json({ data }, { status: 201 });
    return setAuthCookies(accessToken, refreshToken, { accessMaxAge, refreshMaxAge }, baseRes);
  }

  if (!academyCode) {
    return NextResponse.json({ error: "academyCode or inviteToken is required" }, { status: 400 });
  }

  const academy = await prisma.academy.findUnique({ where: { code: academyCode } });
  if (!academy) return NextResponse.json({ error: "Academy not found" }, { status: 404 });
  if (academy.status === "SUSPENDED") return NextResponse.json({ error: "Academy is suspended" }, { status: 403 });

  academyId = academy.id;
  role      = "STUDENT";

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { name, email, passwordHash, role, academyId, status: "ACTIVE" } });

  await writeAuditLog({ actorUserId: user.id, academyId, action: "user.register_student", targetType: "User", targetId: user.id, ip });

  const { refreshToken, expiresAt } = await createSession({ userId: user.id, academyId, ip, userAgent: req.headers.get("user-agent") ?? undefined });
  const accessToken   = await signAccessToken({ sub: user.id, role, academyId });
  const accessMaxAge  = parseDurationMs(process.env.JWT_ACCESS_EXPIRES ?? "15m") / 1000;
  const refreshMaxAge = (expiresAt.getTime() - Date.now()) / 1000;

  const data = { id: user.id, name: user.name, email: user.email, role, academyId, accessToken };
  const baseRes = NextResponse.json({ data }, { status: 201 });
  return setAuthCookies(accessToken, refreshToken, { accessMaxAge, refreshMaxAge }, baseRes);
}
