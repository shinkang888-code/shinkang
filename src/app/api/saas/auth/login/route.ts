/**
 * POST /api/saas/auth/login
 * ─────────────────────────────
 * Body: { email, password }
 * Returns: { accessToken, refreshToken, user }
 *
 * Guard checks:
 * - user must be ACTIVE
 * - academy (if any) must be ACTIVE
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
import { LoginSchema } from "@/saas/lib/schemas";
import { saasOk, saasError, writeAuditLog } from "@/saas/guards";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return saasError("Validation failed", 400, parsed.error.flatten());
  }

  const { email, password } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? undefined;

  // 1. Find user
  const user = await saasPrisma.saasUser.findUnique({
    where: { email },
    include: { academy: { select: { id: true, status: true, name: true } } },
  });

  if (!user) {
    return saasError("Invalid email or password.", 401);
  }

  // 2. Check user status
  if (user.status !== "ACTIVE") {
    return saasError("Your account is suspended. Please contact administrator.", 403);
  }

  // 3. Check academy status (if not SUPER_ADMIN)
  if (user.role !== "SUPER_ADMIN" && user.academy) {
    if (user.academy.status !== "ACTIVE") {
      return saasError(
        "This academy has been suspended. Please contact the platform administrator.",
        403
      );
    }
  }

  // 4. Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return saasError("Invalid email or password.", 401);
  }

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
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    academyId: user.academyId ?? undefined,
    action: "user.login",
    targetType: "user",
    targetId: user.id,
    ip,
  });

  return saasOk({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      academyId: user.academyId,
      academy: user.academy,
      status: user.status,
    },
  });
}
