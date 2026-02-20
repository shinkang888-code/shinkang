// src/lib/guards/withAuth.ts
// Route-level authentication + tenant scoping guard
//
// Usage in route handler:
//   export const GET = withAuth(handler, { roles: ["ADMIN", "SUPER_ADMIN"] });

import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, type AccessTokenPayload, type VerifiedPayload } from "../auth/jwt";
import { scopedPrisma, type TenantContext } from "../db/tenant-extension";
import { prisma } from "../db/prisma";

export interface AuthContext {
  user: VerifiedPayload;
  tenantDb: ReturnType<typeof scopedPrisma>;
  rawPrisma: typeof prisma;
  req: NextRequest;
}

type RouteHandler = (
  req: NextRequest,
  ctx: AuthContext,
  params?: Record<string, string>
) => Promise<NextResponse> | NextResponse;

interface GuardOptions {
  /** Allowed roles. If empty/omitted, any authenticated role is allowed. */
  roles?: string[];
  /** If true, this route can only be called by SUPER_ADMIN */
  superAdminOnly?: boolean;
}

/** Extract bearer OR cookie access token from request */
function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.cookies.get("sa_access")?.value ?? null;
}

export function withAuth(handler: RouteHandler, opts: GuardOptions = {}) {
  return async (
    req: NextRequest,
    context?: { params?: Record<string, string> }
  ): Promise<NextResponse> => {
    // 1. Extract token
    const token = extractToken(req);
    if (!token) {
      return apiError("Unauthorized", 401);
    }

    // 2. Verify JWT
    let payload: VerifiedPayload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return apiError("Invalid or expired token", 401);
    }

    // 3. Verify user still exists and is active
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === "SUSPENDED") {
      return apiError("Account suspended or not found", 403);
    }

    // 4. Check academy suspension (non-SUPER_ADMIN)
    if (user.academyId && user.role !== "SUPER_ADMIN") {
      const academy = await prisma.academy.findUnique({
        where: { id: user.academyId },
        select: { status: true },
      });
      if (!academy || academy.status === "SUSPENDED") {
        return apiError("Academy suspended", 403);
      }
    }

    // 5. Role checks
    if (opts.superAdminOnly && user.role !== "SUPER_ADMIN") {
      return apiError("Super admin access required", 403);
    }

    if (opts.roles && opts.roles.length > 0 && !opts.roles.includes(user.role)) {
      return apiError(`Requires role: ${opts.roles.join(" | ")}`, 403);
    }

    // 6. Build tenant-scoped DB client
    const tenantCtx: TenantContext = {
      academyId: user.academyId,
      role: user.role,
    };
    const tenantDb = scopedPrisma(tenantCtx);

    // 7. Call actual handler
    return handler(req, { user: payload, tenantDb, rawPrisma: prisma, req }, context?.params);
  };
}

// ─── Helper response constructors ────────────────────────

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json({ success: false, error: message, ...(details ? { details } : {}) }, { status });
}
