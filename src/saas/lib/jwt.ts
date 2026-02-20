/**
 * JWT utilities for SaaS auth
 * Access token: 15m, signed with JWT_ACCESS_SECRET
 * Refresh token: 7d, signed with JWT_REFRESH_SECRET
 */
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

const accessSecret = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET ?? "saas-access-secret-change-in-prod"
);
const refreshSecret = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET ?? "saas-refresh-secret-change-in-prod"
);

export interface AccessPayload {
  sub: string;       // userId
  email: string;
  role: string;
  academyId: string | null;
  name: string;
}

export interface RefreshPayload {
  sub: string;       // userId
  jti: string;       // token ID for revocation
}

// ─── Sign ───────────────────────────────────────────────────────

export async function signAccessToken(payload: AccessPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret);
}

export async function signRefreshToken(payload: RefreshPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(refreshSecret);
}

// ─── Verify ─────────────────────────────────────────────────────

export async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    return payload as unknown as AccessPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret);
    return payload as unknown as RefreshPayload;
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/** Hash a refresh token for storage comparison */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Generate a random refresh token JTI */
export function generateJti(): string {
  return crypto.randomUUID();
}

/** Refresh token expiry as Date (7 days from now) */
export function refreshExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
