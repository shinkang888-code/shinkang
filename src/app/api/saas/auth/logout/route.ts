/**
 * POST /api/saas/auth/logout
 * Revokes the refresh token from DB
 */
import { NextRequest } from "next/server";
import { saasPrisma } from "@/saas/lib/prisma";
import { verifyRefreshToken, hashToken } from "@/saas/lib/jwt";
import { saasOk, saasError } from "@/saas/guards";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const { refreshToken } = (body as { refreshToken?: string }) ?? {};
  if (!refreshToken) return saasError("refreshToken required", 400);

  const payload = await verifyRefreshToken(refreshToken);
  if (payload) {
    await saasPrisma.refreshToken
      .updateMany({
        where: { tokenHash: hashToken(refreshToken), revoked: false },
        data: { revoked: true },
      })
      .catch(() => {}); // ignore if already revoked
  }

  return saasOk({ message: "Logged out successfully" });
}
