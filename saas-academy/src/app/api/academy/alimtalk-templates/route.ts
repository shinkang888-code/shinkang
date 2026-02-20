/**
 * GET  /api/academy/alimtalk-templates       – list templates for academy
 * POST /api/academy/alimtalk-templates       – upsert template (by type)
 *
 * RBAC: ADMIN, SUPER_ADMIN
 */
import { type NextRequest, NextResponse } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { audit }  from "@/lib/auth/audit";
import { UpsertAlimtalkTemplateSchema } from "@/lib/validators/notifications";

function resolveAcademyId(ctx: { user: { role: string }; academyId: string | null }, url: URL): string | null {
  if (ctx.user.role === "SUPER_ADMIN") return url.searchParams.get("academyId");
  return ctx.academyId;
}

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  const academyId = resolveAcademyId(ctx, req.nextUrl);
  if (!academyId) return err("academyId required", 400);

  const templates = await prisma.alimtalkTemplate.findMany({
    where:   { academyId },
    orderBy: { type: "asc" },
  });

  return ok(templates);
}

export async function POST(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  const academyId = resolveAcademyId(ctx, req.nextUrl);
  if (!academyId) return err("academyId required", 400);

  const body = await parseBody(req, UpsertAlimtalkTemplateSchema);
  if (body instanceof NextResponse) return body;

  // Upsert: unique on (academyId, type)
  const template = await prisma.alimtalkTemplate.upsert({
    where: {
      academyId_type: { academyId, type: body.type },
    },
    create: {
      academyId,
      type:         body.type,
      templateCode: body.templateCode,
      senderKey:    body.senderKey,
      isActive:     body.isActive,
    },
    update: {
      templateCode: body.templateCode,
      senderKey:    body.senderKey,
      isActive:     body.isActive,
    },
  });

  await audit({
    actorUserId: ctx.user.sub,
    academyId,
    action:      "alimtalkTemplate.upsert",
    targetType:  "AlimtalkTemplate",
    targetId:    template.id,
    metaJson:    { type: body.type, templateCode: body.templateCode },
  });

  return ok(template, 200);
}
