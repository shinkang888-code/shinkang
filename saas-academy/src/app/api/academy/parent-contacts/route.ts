/**
 * POST   /api/academy/parent-contacts          – create parent contact
 * GET    /api/academy/parent-contacts?studentUserId=... – list contacts for student
 *
 * RBAC: ADMIN, SUPER_ADMIN
 */
import { type NextRequest, NextResponse } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma }  from "@/lib/db/client";
import { audit }   from "@/lib/auth/audit";
import {
  CreateParentContactSchema,
} from "@/lib/validators/notifications";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  const studentUserId = req.nextUrl.searchParams.get("studentUserId");
  if (!studentUserId) {
    return err("studentUserId query param required", 400);
  }

  // Ensure student belongs to this academy (tenant isolation)
  if (ctx.user.role !== "SUPER_ADMIN") {
    const student = await prisma.user.findFirst({
      where: { id: studentUserId, academyId: ctx.academyId! },
    });
    if (!student) return err("Student not found", 404);
  }

  const contacts = await prisma.parentContact.findMany({
    where: {
      studentUserId,
      ...(ctx.user.role !== "SUPER_ADMIN" ? { academyId: ctx.academyId! } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  return ok(contacts);
}

export async function POST(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, CreateParentContactSchema);
  if (body instanceof NextResponse) return body;

  const academyId = ctx.user.role === "SUPER_ADMIN"
    ? (req.nextUrl.searchParams.get("academyId") ?? body.studentUserId)  // fallback – SA provides academyId
    : ctx.academyId!;

  // Verify student belongs to academy
  if (ctx.user.role !== "SUPER_ADMIN") {
    const student = await prisma.user.findFirst({
      where: { id: body.studentUserId, academyId },
    });
    if (!student) return err("Student not found in this academy", 404);
  }

  const contact = await prisma.parentContact.create({
    data: {
      academyId,
      studentUserId:     body.studentUserId,
      name:              body.name,
      phone:             body.phone,
      relationship:      body.relationship,
      notificationOptIn: body.notificationOptIn,
      preferredLanguage: body.preferredLanguage,
      consentRecordedAt: body.notificationOptIn ? new Date() : null,
    },
  });

  await audit({
    actorUserId: ctx.user.sub,
    academyId,
    action:     "parentContact.create",
    targetType: "ParentContact",
    targetId:   contact.id,
    metaJson:   { studentUserId: body.studentUserId, relationship: body.relationship },
  });

  return ok(contact, 201);
}
