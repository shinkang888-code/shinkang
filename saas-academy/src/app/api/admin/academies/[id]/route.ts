/**
 * GET    /api/admin/academies/[id]
 * PATCH  /api/admin/academies/[id]
 * DELETE /api/admin/academies/[id]
 * SUPER_ADMIN only.
 */
import { NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { PatchAcademySchema } from "@/lib/validators/auth";
import { audit } from "@/lib/auth/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const academy = await prisma.academy.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!academy) return err("Academy not found", 404);
  return ok(academy);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = await parseBody(req, PatchAcademySchema);
  if (body instanceof Response) return body;

  const existing = await prisma.academy.findUnique({ where: { id } });
  if (!existing) return err("Academy not found", 404);

  const academy = await prisma.academy.update({ where: { id }, data: body });

  await audit({
    actorUserId: ctx.user.sub,
    academyId: id,
    action: "academy.update",
    targetType: "Academy",
    targetId: id,
    metaJson: body as any,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return ok(academy);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const existing = await prisma.academy.findUnique({ where: { id } });
  if (!existing) return err("Academy not found", 404);

  // Cascade deletes users/invites/sessions via FK
  await prisma.academy.delete({ where: { id } });

  await audit({
    actorUserId: ctx.user.sub,
    action: "academy.delete",
    targetType: "Academy",
    targetId: id,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return ok({ deleted: true });
}
