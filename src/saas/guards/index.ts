/**
 * SaaS Guards & Middleware
 * ─────────────────────────────────────────────────────────────────
 * requireSaasAuth()       – any authenticated SaaS user
 * requireSuperAdmin()     – SUPER_ADMIN only
 * requireAcademyAdmin()   – ADMIN of an active academy
 * requireTeacherOrAbove() – TEACHER | ADMIN of active academy
 * withAcademyScope()      – injects academyId from token, enforces it
 * ─────────────────────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/saas-client";
import {
  verifyAccessToken,
  type AccessPayload,
} from "../lib/jwt";
import { saasPrisma } from "../lib/prisma";

// ─── Extract Bearer token ────────────────────────────────────────

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

// ─── Cookie fallback (for SSR pages) ────────────────────────────

function extractCookie(req: NextRequest): string | null {
  return req.cookies.get("saas_access_token")?.value ?? null;
}

// ─── Core auth resolver ──────────────────────────────────────────

export async function resolveSaasUser(
  req: NextRequest
): Promise<{ user: AccessPayload } | { error: NextResponse }> {
  const token = extractBearer(req) ?? extractCookie(req);
  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return {
      error: NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }

  return { user: payload };
}

// ─── Guards ──────────────────────────────────────────────────────

/** Any authenticated SaaS user */
export async function requireSaasAuth(req: NextRequest) {
  return resolveSaasUser(req);
}

/** SUPER_ADMIN only */
export async function requireSuperAdmin(req: NextRequest) {
  const result = await resolveSaasUser(req);
  if ("error" in result) return result;
  if (result.user.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { success: false, error: "Forbidden: SUPER_ADMIN required" },
        { status: 403 }
      ),
    };
  }
  return result;
}

/** ADMIN of an active academy */
export async function requireAcademyAdmin(req: NextRequest) {
  const result = await resolveSaasUser(req);
  if ("error" in result) return result;
  if (result.user.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { success: false, error: "Forbidden: ADMIN required" },
        { status: 403 }
      ),
    };
  }
  await assertAcademyActive(result.user.academyId);
  return result;
}

/** TEACHER or ADMIN */
export async function requireTeacherOrAbove(req: NextRequest) {
  const result = await resolveSaasUser(req);
  if ("error" in result) return result;
  if (!["TEACHER", "ADMIN"].includes(result.user.role)) {
    return {
      error: NextResponse.json(
        { success: false, error: "Forbidden: TEACHER or ADMIN required" },
        { status: 403 }
      ),
    };
  }
  await assertAcademyActive(result.user.academyId);
  return result;
}

// ─── Academy scope enforcement ───────────────────────────────────

/**
 * Ensure the `academyId` in the token matches the resource's academyId.
 * SUPER_ADMIN bypasses this check.
 */
export function assertTenantScope(
  userAcademyId: string | null,
  userRole: string,
  resourceAcademyId: string
): NextResponse | null {
  if (userRole === "SUPER_ADMIN") return null; // bypass
  if (userAcademyId !== resourceAcademyId) {
    return NextResponse.json(
      { success: false, error: "Forbidden: tenant scope violation" },
      { status: 403 }
    );
  }
  return null;
}

// ─── Academy active check ────────────────────────────────────────

async function assertAcademyActive(academyId: string | null): Promise<void> {
  if (!academyId) return;
  const academy = await saasPrisma.academy.findUnique({
    where: { id: academyId },
    select: { status: true },
  });
  if (!academy || academy.status !== "ACTIVE") {
    throw new TenantSuspendedError(
      "Academy is suspended or deleted"
    );
  }
}

export class TenantSuspendedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "TenantSuspendedError";
  }
}

// ─── API response helpers ────────────────────────────────────────

export function saasOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function saasError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, ...(details ? { details } : {}) },
    { status }
  );
}

// ─── Audit log helper ────────────────────────────────────────────

export async function writeAuditLog(opts: {
  actorUserId?: string;
  academyId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      actorUserId: opts.actorUserId,
      academyId: opts.academyId,
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId,
      metadata: opts.metadata as Prisma.InputJsonValue,
      ip: opts.ip,
    };
    await saasPrisma.auditLog.create({ data });
  } catch {
    // Non-blocking — don't fail the request for audit errors
  }
}
