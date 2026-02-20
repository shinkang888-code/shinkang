/**
 * PATCH /api/admin/users/[id]
 * SUPER_ADMIN only — update any user (name, status, role).
 */
import { NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { PatchUserSchema } from "@/lib/validators/auth";
import { audit } from "@/lib/auth/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = await parseBody(req, PatchUserSchema);
  if (body instanceof Response) return body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return err("User not found", 404);

  // Prevent demoting SUPER_ADMIN via this endpoint
  if (existing.role === "SUPER_ADMIN") {
    return err("Cannot modify SUPER_ADMIN via this endpoint", 403);
  }

  const user = await prisma.user.update({
    where: { id },
    data: body as any,
    select: {
      id: true, name: true, email: true, role: true,
      status: true, academyId: true, updatedAt: true,
    },
  });

  await audit({
    actorUserId: ctx.user.sub,
    academyId: user.academyId,
    action: "user.update",
    targetType: "User",
    targetId: id,
    metaJson: body as any,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return ok(user);
}
