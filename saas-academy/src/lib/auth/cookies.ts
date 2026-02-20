/**
 * src/lib/auth/cookies.ts
 *
 * Hardened cookie helpers for access + refresh tokens.
 *
 * Security settings:
 *   httpOnly:  true  → JS cannot read the cookie
 *   sameSite:  lax   → CSRF protection
 *   secure:    true  → HTTPS only in production
 *   path:      /     → available across the whole app
 *
 * Cookie names (canonical):
 *   sa_access   – 15-min access token
 *   sa_refresh  – 7-day refresh token (path restricted to /api/auth/refresh)
 *   sa_csrf     – CSRF double-submit token (JS-readable)
 */
import { NextResponse } from "next/server";

const IS_PROD = process.env.NODE_ENV === "production";

export const ACCESS_COOKIE  = "sa_access";
export const REFRESH_COOKIE = "sa_refresh";
export const CSRF_COOKIE    = "sa_csrf";

export interface SetCookiesOptions {
  accessMaxAge:  number; // seconds
  refreshMaxAge: number; // seconds
}

/**
 * Set auth cookies on an existing NextResponse (or new one if not provided).
 * Returns the response with cookies set.
 */
export function setAuthCookies(
  accessToken:  string,
  refreshToken: string,
  opts: SetCookiesOptions,
  response?: NextResponse,
): NextResponse {
  const res = response ?? NextResponse.json({ ok: true });

  res.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: "lax",
    path:     "/",
    maxAge:   opts.accessMaxAge,
  });

  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: "lax",
    path:     "/api/auth/refresh",
    maxAge:   opts.refreshMaxAge,
  });

  return res;
}

export function clearAuthCookies(response?: NextResponse): NextResponse {
  const res = response ?? NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE,  "", { httpOnly: true, maxAge: 0, path: "/" });
  res.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/api/auth/refresh" });
  res.cookies.set(CSRF_COOKIE,    "", { httpOnly: false, maxAge: 0, path: "/" });
  return res;
}

/** Extract access token from a NextRequest (cookie or Bearer) */
export function getAccessTokenFromRequest(
  req: Parameters<typeof NextResponse.json>[0] extends never ? never : { cookies: { get: (name: string) => { value: string } | undefined }; headers: { get: (name: string) => string | null } }
): string | null {
  const auth = (req as any).headers?.get?.("authorization") as string | null;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return (req as any).cookies?.get?.(ACCESS_COOKIE)?.value ?? null;
}
