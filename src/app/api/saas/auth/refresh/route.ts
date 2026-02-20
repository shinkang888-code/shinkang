/**
 * POST /api/saas/auth/refresh
 * ─────────────────────────────
 * Body: { refreshToken }
 * Returns: { accessToken, refreshToken }
 * 
 * Implements token rotation: old refresh token is revoked, new one issued.
 */
import { NextRequest } from "next/server";
import { saasPrisma } from "@/saas/lib/prisma";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  hashToken,
  generateJti,
  refreshExpiry,
} from "@/saas/lib/jwt";
import { RefreshSchema } from "@/saas/lib/schemas";
import { saasOk, saasError } from "@/saas/guards";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const parsed = RefreshSchema.safeParse(body);
  if (!parsed.success) return saasError("refreshToken required", 400);

  const { refreshToken } = parsed.data;

  // 1. Verify JWT signature
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) return saasError("Invalid or expired refresh token", 401);

  // 2. Check DB: token must exist, not revoked, not expired
  const stored = await saasPrisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
  });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    return saasError("Refresh token invalid or expired", 401);
  }

  // 3. Load user
  const user = await saasPrisma.saasUser.findUnique({
    where: { id: payload.sub },
    include: { academy: { select: { status: true } } },
  });

  if (!user || user.status !== "ACTIVE") {
    return saasError("User not found or suspended", 403);
  }
  if (user.role !== "SUPER_ADMIN" && user.academy?.status !== "ACTIVE") {
    return saasError("Academy is suspended", 403);
  }

  // 4. Revoke old token, issue new pair (rotation)
  const newJti = generateJti();
  const [newAccessToken, newRefreshToken] = await Promise.all([
    signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      academyId: user.academyId,
      name: user.name,
    }),
    signRefreshToken({ sub: user.id, jti: newJti }),
  ]);

  await saasPrisma.$transaction([
    saasPrisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    }),
    saasPrisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: refreshExpiry(),
        ip: req.headers.get("x-forwarded-for") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    }),
  ]);

  return saasOk({ accessToken: newAccessToken, refreshToken: newRefreshToken });
}
