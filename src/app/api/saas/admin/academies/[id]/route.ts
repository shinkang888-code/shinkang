/**
 * GET    /api/saas/admin/academies/[id]  — get single academy
 * PATCH  /api/saas/admin/academies/[id]  — update (incl. status change)
 * DELETE /api/saas/admin/academies/[id]  — soft-delete
 */
import { NextRequest } from "next/server";
import { requireSuperAdmin, saasOk, saasError, writeAuditLog } from "@/saas/guards";
import { saasPrisma } from "@/saas/lib/prisma";
import { UpdateAcademySchema } from "@/saas/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const academy = await saasPrisma.academy.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
      users: {
        where: { role: "ADMIN" },
        select: { id: true, name: true, email: true },
        take: 5,
      },
    },
  });

  if (!academy) return saasError("Academy not found", 404);
  return saasOk({ academy });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const parsed = UpdateAcademySchema.safeParse(body);
  if (!parsed.success) return saasError("Validation failed", 400, parsed.error.flatten());

  const academy = await saasPrisma.academy.findUnique({ where: { id } });
  if (!academy) return saasError("Academy not found", 404);

  const updated = await saasPrisma.academy.update({
    where: { id },
    data: parsed.data,
  });

  await writeAuditLog({
    actorUserId: auth.user.sub,
    academyId: id,
    action: parsed.data.status ? `academy.${parsed.data.status.toLowerCase()}` : "academy.update",
    targetType: "academy",
    targetId: id,
    metadata: parsed.data as Record<string, unknown>,
  });

  return saasOk({ academy: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const academy = await saasPrisma.academy.findUnique({ where: { id } });
  if (!academy) return saasError("Academy not found", 404);

  // Soft delete: set status to DELETED
  await saasPrisma.academy.update({
    where: { id },
    data: { status: "DELETED" },
  });

  await writeAuditLog({
    actorUserId: auth.user.sub,
    academyId: id,
    action: "academy.delete",
    targetType: "academy",
    targetId: id,
  });

  return saasOk({ deleted: true });
}
