/**
 * src/lib/guards/route-guard.ts
 *
 * Composable route-handler guard utilities.
 *
 * Usage in route handler:
 *
 *   export async function GET(req: NextRequest) {
 *     const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
 *     if (ctx instanceof NextResponse) return ctx;
 *     // ctx is { user, db, rawDb, academyId }
 *   }
 */
import { type NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, type VerifiedPayload } from "@/lib/auth/jwt";
import { scopedPrisma, type TenantContext } from "@/lib/db/tenant-extension";
import { prisma } from "@/lib/db/client";

export interface RouteContext {
  user:      VerifiedPayload;
  db:        ReturnType<typeof scopedPrisma>;
  rawDb:     typeof prisma;
  academyId: string | null;
}

/** Extract bearer OR cookie access token */
function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  // Cookie name: sa_access (canonical)
  return req.cookies.get("sa_access")?.value ?? null;
}

/**
 * Main guard. Returns RouteContext on success, NextResponse on failure.
 * @param allowedRoles – if empty, any authenticated user passes
 */
export async function guardRoute(
  req: NextRequest,
  allowedRoles: string[] = [],
): Promise<RouteContext | NextResponse> {
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let user: VerifiedPayload;
  try {
    user = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Additional check: if non-SUPER_ADMIN, verify academy is still ACTIVE
  if (user.role !== "SUPER_ADMIN" && user.academyId) {
    const academy = await prisma.academy.findUnique({
      where:  { id: user.academyId },
      select: { status: true },
    });
    if (!academy || academy.status === "SUSPENDED") {
      return NextResponse.json({ error: "Academy is suspended" }, { status: 403 });
    }
  }

  const tenantCtx: TenantContext = {
    academyId: user.academyId,
    role:      user.role,
  };

  return {
    user,
    db:        scopedPrisma(tenantCtx),
    rawDb:     prisma,
    academyId: user.academyId,
  };
}

/** Convenience: guard that also ensures SAME academy as param */
export async function guardAcademyParam(
  req: NextRequest,
  paramAcademyId: string,
  allowedRoles: string[] = ["ADMIN", "SUPER_ADMIN"],
): Promise<RouteContext | NextResponse> {
  const ctx = await guardRoute(req, allowedRoles);
  if (ctx instanceof NextResponse) return ctx;

  // SUPER_ADMIN may access any academy
  if (ctx.user.role === "SUPER_ADMIN") return ctx;

  if (ctx.academyId !== paramAcademyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return ctx;
}

/** Parse JSON body safely, return 422 on failure */
export async function parseBody<T>(
  req: NextRequest,
  schema: {
    safeParse: (
      v: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { flatten: () => unknown } };
  },
): Promise<T | NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: (result as any).error.flatten() },
      { status: 422 },
    );
  }
  return result.data;
}

/** Standardised success response */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

/** Standardised error response */
export function err(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}
