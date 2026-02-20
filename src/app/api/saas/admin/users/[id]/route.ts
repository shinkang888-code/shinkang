/**
 * GET   /api/saas/admin/users/[id]  — get user (SUPER_ADMIN)
 * PATCH /api/saas/admin/users/[id]  — update user (SUPER_ADMIN)
 */
import { NextRequest } from "next/server";
import { requireSuperAdmin, saasOk, saasError, writeAuditLog } from "@/saas/guards";
import { saasPrisma } from "@/saas/lib/prisma";
import { UpdateUserSuperAdminSchema } from "@/saas/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const user = await saasPrisma.saasUser.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, role: true,
      status: true, academyId: true, createdAt: true, updatedAt: true,
      academy: { select: { id: true, name: true, code: true, status: true } },
    },
  });

  if (!user) return saasError("User not found", 404);
  return saasOk({ user });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const parsed = UpdateUserSuperAdminSchema.safeParse(body);
  if (!parsed.success) return saasError("Validation failed", 400, parsed.error.flatten());

  const existing = await saasPrisma.saasUser.findUnique({ where: { id } });
  if (!existing) return saasError("User not found", 404);

  const updated = await saasPrisma.saasUser.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true, email: true, name: true, role: true,
      status: true, academyId: true, updatedAt: true,
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
