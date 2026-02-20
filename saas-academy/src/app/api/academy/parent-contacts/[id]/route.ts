/**
 * GET    /api/academy/parent-contacts/[id]   – fetch one contact
 * PATCH  /api/academy/parent-contacts/[id]   – update contact
 * DELETE /api/academy/parent-contacts/[id]   – soft-delete (status→INACTIVE)
 *
 * RBAC: ADMIN, SUPER_ADMIN
 */
import { type NextRequest, NextResponse } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { audit }  from "@/lib/auth/audit";
import { UpdateParentContactSchema } from "@/lib/validators/notifications";

type Params = { params: Promise<{ id: string }> };

// ── shared helper ────────────────────────────────────────────────────────────

async function loadContact(id: string, academyId: string | null, isSuperAdmin: boolean) {
  return prisma.parentContact.findFirst({
    where: {
      id,
      ...(isSuperAdmin ? {} : { academyId: academyId! }),
    },
  });
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const contact = await loadContact(id, ctx.academyId, ctx.user.role === "SUPER_ADMIN");
  if (!contact) return err("Contact not found", 404);

  return ok(contact);
}

// ── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await loadContact(id, ctx.academyId, ctx.user.role === "SUPER_ADMIN");
  if (!existing) return err("Contact not found", 404);

  const body = await parseBody(req, UpdateParentContactSchema);
  if (body instanceof NextResponse) return body;

  // If toggling notificationOptIn to true, record consent timestamp
  const consentRecordedAt =
    body.notificationOptIn === true && !existing.notificationOptIn
      ? new Date()
      : body.consentRecordedAt !== undefined
        ? (body.consentRecordedAt ? new Date(body.consentRecordedAt) : null)
        : undefined;

  const updated = await prisma.parentContact.update({
    where: { id },
    data:  {
      ...(body.name              !== undefined ? { name: body.name }                         : {}),
      ...(body.phone             !== undefined ? { phone: body.phone }                       : {}),
      ...(body.relationship      !== undefined ? { relationship: body.relationship }         : {}),
      ...(body.notificationOptIn !== undefined ? { notificationOptIn: body.notificationOptIn } : {}),
      ...(body.preferredLanguage !== undefined ? { preferredLanguage: body.preferredLanguage } : {}),
      ...(body.status            !== undefined ? { status: body.status }                     : {}),
      ...(consentRecordedAt      !== undefined ? { consentRecordedAt }                        : {}),
    },
  });

  await audit({
    actorUserId: ctx.user.sub,
    academyId:   existing.academyId,
    action:      "parentContact.update",
    targetType:  "ParentContact",
    targetId:    id,
    metaJson:    body as Record<string, unknown>,
  });

  return ok(updated);
}

// ── DELETE (soft) ────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await loadContact(id, ctx.academyId, ctx.user.role === "SUPER_ADMIN");
  if (!existing) return err("Contact not found", 404);

  await prisma.parentContact.update({
    where: { id },
    data:  { status: "INACTIVE" },
  });

  await audit({
    actorUserId: ctx.user.sub,
    academyId:   existing.academyId,
    action:      "parentContact.delete",
    targetType:  "ParentContact",
    targetId:    id,
  });

  return ok({ id, deleted: true });
}
