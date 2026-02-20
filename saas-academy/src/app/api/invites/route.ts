/**
 * POST /api/invites
 *
 * Create a single-use invite link for TEACHER or ADMIN.
 * Allowed by: ADMIN (own academy only) | SUPER_ADMIN (any academy via body.academyId)
 *
 * Returns: { token, link, expiresAt }  — token shown ONCE, never stored raw
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { CreateInviteSchema } from "@/lib/validators/auth";
import { audit } from "@/lib/auth/audit";
import crypto from "crypto";

const INVITE_TTL_HOURS = 48;

function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}
function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const body = await parseBody(req, CreateInviteSchema);
  if (body instanceof Response) return body;

  // Determine target academy
  let targetAcademyId: string;
  if (ctx.user.role === "SUPER_ADMIN") {
    if (!body.academyId) return err("academyId required for SUPER_ADMIN", 422);
    targetAcademyId = body.academyId;
  } else {
    // ADMIN is always scoped to own academy
    if (!ctx.academyId) return err("Forbidden", 403);
    targetAcademyId = ctx.academyId;
  }

  // ADMIN cannot create ADMIN invites — only SUPER_ADMIN can
  if (ctx.user.role === "ADMIN" && body.role === "ADMIN") {
    return err("ADMIN cannot invite another ADMIN", 403);
  }

  const academy = await prisma.academy.findUnique({ where: { id: targetAcademyId } });
  if (!academy) return err("Academy not found", 404);

  const rawToken = generateInviteToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600_000);

  await prisma.invite.create({
    data: {
      academyId: targetAcademyId,
      role: body.role as any,
      tokenHash,
      expiresAt,
      createdBy: ctx.user.sub,
    },
  });

  await audit({
    actorUserId: ctx.user.sub,
    academyId: targetAcademyId,
    action: "invite.create",
    targetType: "Invite",
    metaJson: { role: body.role },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  const baseUrl = process.env.APP_URL ?? "http://localhost:3001";
  const link = `${baseUrl}/register?invite=${rawToken}`;

  return ok({ token: rawToken, link, expiresAt, role: body.role }, 201);
}
