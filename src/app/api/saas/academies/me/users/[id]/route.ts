/**
 * PATCH /api/saas/academies/me/users/[id]  — update user in MY academy (ADMIN only)
 *
 * Tenant scope: verifies the target user belongs to actor's academy (no cross-tenant access)
 */
import { NextRequest } from "next/server";
import {
  requireAcademyAdmin,
  saasOk,
  saasError,
  assertTenantScope,
  writeAuditLog,
  TenantSuspendedError,
} from "@/saas/guards";
import { saasPrisma } from "@/saas/lib/prisma";
import { UpdateUserSchema } from "@/saas/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  let auth;
  try {
    auth = await requireAcademyAdmin(req);
  } catch (e) {
    if (e instanceof TenantSuspendedError) return saasError(e.message, 403);
    throw e;
  }
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const user = await saasPrisma.saasUser.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true,
      role: true, status: true, academyId: true, createdAt: true,
    },
  });

  if (!user) return saasError("User not found", 404);

  // ⚡ Tenant scope check
  const scopeError = assertTenantScope(auth.user.academyId, auth.user.role, user.academyId!);
  if (scopeError) return scopeError;

  return saasOk({ user });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  let auth;
  try {
    auth = await requireAcademyAdmin(req);
  } catch (e) {
    if (e instanceof TenantSuspendedError) return saasError(e.message, 403);
    throw e;
  }
  if ("error" in auth) return auth.error;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) return saasError("Validation failed", 400, parsed.error.flatten());

  const existing = await saasPrisma.saasUser.findUnique({ where: { id } });
  if (!existing) return saasError("User not found", 404);

  // ⚡ Tenant scope: ADMIN cannot update users from other academies
  const scopeError = assertTenantScope(
    auth.user.academyId,
    auth.user.role,
    existing.academyId!
  );
  if (scopeError) return scopeError;

  // UpdateUserSchema only allows TEACHER/STUDENT roles — ADMIN/SUPER_ADMIN promotion is
  // blocked at validation layer by the schema enum constraint.

  const updated = await saasPrisma.saasUser.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true, email: true, name: true,
      role: true, status: true, academyId: true, updatedAt: true,
    },
  });

  await writeAuditLog({
    actorUserId: auth.user.sub,
    academyId: existing.academyId ?? undefined,
    action: "user.update",
    targetType: "user",
    targetId: id,
    metadata: parsed.data as Record<string, unknown>,
  });

  return saasOk({ user: updated });
}
