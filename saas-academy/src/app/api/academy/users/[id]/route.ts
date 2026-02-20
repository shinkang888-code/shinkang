/**
 * PATCH /api/academy/users/[id]
 * ADMIN only — update user within own academy (name, status, role).
 * Tenant isolation enforced by scopedPrisma (WHERE academyId = ctx.academyId).
 */
import { NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { PatchUserSchema } from "@/lib/validators/auth";
import { audit } from "@/lib/auth/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = await parseBody(req, PatchUserSchema);
  if (body instanceof Response) return body;

  // scopedPrisma enforces WHERE academyId = ctx.academyId
  // If user belongs to a different academy, findFirst returns null → 404
  const existing = await ctx.db.user.findFirst({ where: { id } });
  if (!existing) return err("User not found", 404);

  // Prevent ADMIN from promoting anyone to SUPER_ADMIN
  if ((body as any).role === "SUPER_ADMIN") {
    return err("Cannot assign SUPER_ADMIN role", 403);
  }

  const user = await ctx.db.user.update({
    where: { id },
    data: body as any,
    select: {
      id: true, name: true, email: true, role: true,
      status: true, academyId: true, updatedAt: true,
    },
  });

  await audit({
    actorUserId: ctx.user.sub,
    academyId: ctx.academyId,
    action: "user.update",
    targetType: "User",
    targetId: id,
    metaJson: body as any,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return ok(user);
}
