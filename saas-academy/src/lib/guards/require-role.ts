/**
 * src/lib/guards/require-role.ts
 *
 * Route-level guard used by every protected API handler.
 *
 * Usage:
 *   const auth = await requireRole(req, ["ADMIN", "SUPER_ADMIN"]);
 *   if (auth.error) return auth.error;
 *   const { user, db } = auth;
 *   // user is CurrentUser, db is academy-scoped PrismaClient
 *
 * Also validates CSRF token for mutating methods (POST/PUT/PATCH/DELETE).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { scopedPrisma } from "@/lib/db/tenant";

export type AuthResult =
  | {
      error: null;
      user:  { id: string; role: string; academyId: string | null };
      db:    ReturnType<typeof scopedPrisma>;
    }
  | { error: NextResponse; user: null; db: null };

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function requireRole(
  req:           NextRequest,
  allowedRoles:  string[],
  options?:      { skipCsrf?: boolean },
): Promise<AuthResult> {
  // ── 1. Extract access token from cookie ────────────────────────────────
  const token = req.cookies.get("sa_access")?.value;
  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null, db: null,
    };
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null, db: null,
    };
  }

  // ── 2. Role check ───────────────────────────────────────────────────────
  if (!allowedRoles.includes(payload.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user: null, db: null,
    };
  }

  // ── 3. CSRF check for mutating methods ──────────────────────────────────
  if (MUTATING.has(req.method) && !options?.skipCsrf) {
    const csrfFromHeader = req.headers.get("x-csrf-token");
    const csrfFromCookie = req.cookies.get("sa_csrf")?.value;

    // We validate that the submitted token matches the cookie value.
    // Since the cookie is SameSite=Lax, cross-origin POST cannot set it.
    if (!csrfFromHeader || csrfFromHeader !== csrfFromCookie) {
      return {
        error: NextResponse.json({ error: "CSRF validation failed" }, { status: 403 }),
        user: null, db: null,
      };
    }
  }

  const user = {
    id:        payload.sub,
    role:      payload.role,
    academyId: payload.academyId,
  };

  const db = scopedPrisma({ academyId: payload.academyId, role: payload.role });

  return { error: null, user, db };
}
