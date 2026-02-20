/**
 * src/lib/auth/jwt.ts
 *
 * JWT access + refresh token utilities using the `jose` library.
 *
 * Access token  (15 m): carries userId, role, academyId
 * Refresh token (7 d):  carries userId, sessionId — rotated on every use
 */
import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from "jose";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub:       string;   // userId
  role:      string;
  academyId: string | null;
  type:      "access";
}

export interface RefreshTokenPayload {
  sub:       string;   // userId
  sessionId: string;
  /** Optional — the refresh JWT only needs sub+sessionId for rotation */
  role?:      string;
  academyId?: string | null;
  type:      "refresh";
}

/** Shape returned from verifyAccessToken — used by route-guard */
export interface VerifiedPayload {
  sub:       string;
  role:      string;
  academyId: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSecret(envVar: string): Uint8Array {
  const s = process.env[envVar];
  if (!s || s.length < 32) {
    throw new Error(`${envVar} must be set to a string of at least 32 characters`);
  }
  return new TextEncoder().encode(s);
}

/**
 * Parse a duration string like "15m", "7d", "1h" into milliseconds.
 */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    // Try plain number (seconds)
    const n = Number(duration);
    if (!isNaN(n)) return n * 1000;
    throw new Error(`Invalid duration: ${duration}`);
  }
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 3600 * 1000;
    case "d": return n * 86400 * 1000;
    default:  throw new Error(`Unknown unit: ${match[2]}`);
  }
}

function getDuration(envVar: string, fallback: string): string {
  return process.env[envVar] ?? fallback;
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, "type">,
): Promise<string> {
  return new SignJWT({ ...payload, type: "access" } as AccessTokenPayload & JoseJWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(getDuration("JWT_ACCESS_EXPIRES", "15m"))
    .sign(getSecret("JWT_ACCESS_SECRET"));
}

export async function signRefreshToken(
  payload: Omit<RefreshTokenPayload, "type">,
): Promise<string> {
  return new SignJWT({ ...payload, type: "refresh" } as RefreshTokenPayload & JoseJWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(getDuration("JWT_REFRESH_EXPIRES", "7d"))
    .sign(getSecret("JWT_REFRESH_SECRET"));
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export async function verifyAccessToken(token: string): Promise<VerifiedPayload> {
  const { payload } = await jwtVerify(token, getSecret("JWT_ACCESS_SECRET"));
  const p = payload as unknown as AccessTokenPayload;
  if (p.type !== "access") throw new Error("Not an access token");
  return { sub: p.sub, role: p.role, academyId: p.academyId };
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret("JWT_REFRESH_SECRET"));
    const p = payload as unknown as RefreshTokenPayload;
    if (p.type !== "refresh") return null;
    return p;
  } catch {
    return null;
  }
}
