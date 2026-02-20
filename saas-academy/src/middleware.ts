/**
 * src/middleware.ts
 *
 * Next.js Edge Middleware — two responsibilities:
 *   1. Inject security headers on every response (Helmet-equivalent)
 *   2. Guard dashboard routes: redirect unauthenticated or wrong-role users
 *
 * Auth state is determined by the presence + validity of the access token
 * cookie (lightweight jose verify — no DB call in the Edge).
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ─── Security headers ─────────────────────────────────────────────────────────

function applySecurityHeaders(res: NextResponse): NextResponse {
  // Prevents clickjacking
  res.headers.set("X-Frame-Options", "DENY");
  // Prevents MIME-type sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer policy
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy — disable unneeded browser features
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  // Strict-Transport-Security (only meaningful over HTTPS)
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  // Content-Security-Policy — tight but allows Next.js inline scripts
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed by Next.js dev; tighten in prod
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  return res;
}

// ─── Route protection map ─────────────────────────────────────────────────────

const PROTECTED: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/super-admin", roles: ["SUPER_ADMIN"] },
  { prefix: "/academy-admin", roles: ["ADMIN"] },
  { prefix: "/me", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"] },
];

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets and public API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/auth")
  ) {
    const res = NextResponse.next();
    return applySecurityHeaders(res);
  }

  // Determine which protection rule applies
  const rule = PROTECTED.find((r) => pathname.startsWith(r.prefix));

  if (!rule) {
    // Public route — just add headers
    const res = NextResponse.next();
    return applySecurityHeaders(res);
  }

  // Verify access token in cookie
  const token = req.cookies.get("sa_access")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_ACCESS_SECRET ?? "",
    );
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as { role?: string }).role ?? "";

    if (!rule.roles.includes(role)) {
      // Redirect to role-appropriate home
      const url = req.nextUrl.clone();
      url.pathname =
        role === "SUPER_ADMIN" ? "/super-admin"
        : role === "ADMIN"     ? "/academy-admin"
        : "/me";
      url.search = "";
      return NextResponse.redirect(url);
    }
  } catch {
    // Token invalid or expired — send to login
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    // Clear stale cookie
    res.cookies.delete("sa_access");
    return applySecurityHeaders(res);
  }

  const res = NextResponse.next();
  return applySecurityHeaders(res);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
