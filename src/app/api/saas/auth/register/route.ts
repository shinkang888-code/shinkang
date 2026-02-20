/**
 * POST /api/saas/auth/register
 * ─────────────────────────────
 * Body: { academyCode, name, email, password, role }
 * - Looks up the academy by code
 * - Validates academy is ACTIVE
 * - Creates user with hashed password
 * - TEACHER role requires admin pre-creation (optionally an invite token)
 * Returns: { accessToken, refreshToken, user }
 */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { saasPrisma } from "@/saas/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  generateJti,
  refreshExpiry,
} from "@/saas/lib/jwt";
import { RegisterSchema } from "@/saas/lib/schemas";
import { saasOk, saasError, writeAuditLog } from "@/saas/guards";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return saasError("Validation failed", 400, parsed.error.flatten());
  }

  const { academyCode, name, email, password, role } = parsed.data;

  // 1. Find academy by code
  const academy = await saasPrisma.academy.findUnique({
    where: { code: academyCode },
  });

  if (!academy) {
    return saasError("Academy not found. Please check the academy code.", 404);
  }
  if (academy.status !== "ACTIVE") {
    return saasError(
      "This academy is suspended. Please contact the administrator.",
      403
    );
  }

  // 2. TEACHER self-registration is blocked — must be created by ADMIN
  if (role === "TEACHER") {
    return saasError(
      "Teacher accounts must be created by the academy administrator.",
      403
    );
  }

  // 3. Check email uniqueness
  const existing = await saasPrisma.saasUser.findUnique({ where: { email } });
  if (existing) {
    return saasError("Email already registered.", 409);
  }

  // 4. Hash password & create user
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await saasPrisma.saasUser.create({
    data: {
      academyId: academy.id,
      role,
      name,
      email,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      academyId: true,
      status: true,
      createdAt: true,
    },
  });

  // 5. Issue tokens
  const jti = generateJti();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      academyId: user.academyId,
      name: user.name,
    }),
    signRefreshToken({ sub: user.id, jti }),
  ]);

  await saasPrisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiry(),
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    academyId: academy.id,
    action: "user.register",
    targetType: "user",
    targetId: user.id,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return saasOk({ accessToken, refreshToken, user }, 201);
}
