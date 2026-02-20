/**
 * src/lib/auth/token-store.ts
 *
 * Manages refresh-token sessions in the DB:
 *  - createSession         – after login/register; returns raw refresh token + signed access token
 *  - validateAndConsumeSession – on /auth/refresh (revokes old, returns session data)
 *  - revokeSession         – on /auth/logout by raw token
 *  - revokeAllUserSessions – when user/academy is suspended
 */
import crypto from "crypto";
import { prisma } from "@/lib/db/client";
import { parseDurationMs } from "./jwt";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface CreateSessionInput {
  userId:    string;
  academyId: string | null;
  userAgent?: string;
  ip?:        string;
}

export interface SessionResult {
  /** Raw 128-hex refresh token to store in httpOnly cookie */
  refreshToken: string;
  expiresAt:    Date;
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createSession(input: CreateSessionInput): Promise<SessionResult> {
  const refreshRaw  = crypto.randomBytes(64).toString("hex");
  const refreshHash = hashToken(refreshRaw);
  const dur         = process.env.JWT_REFRESH_EXPIRES ?? "7d";
  const expiresAt   = new Date(Date.now() + parseDurationMs(dur));

  await prisma.session.create({
    data: {
      userId:           input.userId,
      academyId:        input.academyId ?? undefined,
      refreshTokenHash: refreshHash,
      ip:               input.ip,
      userAgent:        input.userAgent,
      expiresAt,
    },
  });

  return { refreshToken: refreshRaw, expiresAt };
}

// ── Validate & consume (used by /auth/refresh) ─────────────────────────────────

export interface ConsumedSession {
  userId:    string;
  academyId: string | null;
}

export async function validateAndConsumeSession(
  rawToken: string,
): Promise<ConsumedSession | null> {
  const hash = hashToken(rawToken);

  const session = await prisma.session.findUnique({
    where:   { refreshTokenHash: hash },
    include: {
      user:    { select: { id: true, status: true, academyId: true } },
      academy: { select: { status: true } },
    },
  });

  if (!session)                             return null;
  if (session.revokedAt)                    return null;
  if (session.expiresAt < new Date())       return null;
  if (session.user.status === "SUSPENDED")  return null;
  if (session.academy?.status === "SUSPENDED") return null;

  // Revoke old session (token rotation)
  await prisma.session.update({
    where: { id: session.id },
    data:  { revokedAt: new Date() },
  });

  return { userId: session.userId, academyId: session.academyId };
}

// ── Revoke by raw token ────────────────────────────────────────────────────────

export async function revokeSession(rawToken: string): Promise<void> {
  const hash = hashToken(rawToken);
  await prisma.session.updateMany({
    where: { refreshTokenHash: hash, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}

// ── Revoke all for a user ──────────────────────────────────────────────────────

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}
