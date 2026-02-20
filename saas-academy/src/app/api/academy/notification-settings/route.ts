/**
 * GET   /api/academy/notification-settings  – fetch current settings
 * PUT   /api/academy/notification-settings  – upsert settings
 *
 * RBAC: ADMIN, SUPER_ADMIN
 */
import { type NextRequest, NextResponse } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { audit }  from "@/lib/auth/audit";
import { UpsertNotificationSettingsSchema } from "@/lib/validators/notifications";

function resolveAcademyId(ctx: { user: { role: string; academyId?: string | null }; academyId: string | null }, url: URL): string | null {
  if (ctx.user.role === "SUPER_ADMIN") {
    return url.searchParams.get("academyId");
  }
  return ctx.academyId;
}

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  const academyId = resolveAcademyId(ctx, req.nextUrl);
  if (!academyId) return err("academyId required", 400);

  const settings = await prisma.academyNotificationSettings.findUnique({
    where: { academyId },
  });

  // Return defaults if not yet configured
  return ok(
    settings ?? {
      academyId,
      alimtalkEnabled:           false,
      sendOnAbsent:              true,
      sendOnLate:                true,
      sendOnExcused:             false,
      allowResendOnStatusChange: false,
      quietHoursEnabled:         true,
      quietHoursStart:           "21:00",
      quietHoursEnd:             "08:00",
    },
  );
}

export async function PUT(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof NextResponse) return ctx;

  const academyId = resolveAcademyId(ctx, req.nextUrl);
  if (!academyId) return err("academyId required", 400);

  const body = await parseBody(req, UpsertNotificationSettingsSchema);
  if (body instanceof NextResponse) return body;

  const settings = await prisma.academyNotificationSettings.upsert({
    where:  { academyId },
    create: {
      academyId,
      alimtalkEnabled:           body.alimtalkEnabled           ?? false,
      sendOnAbsent:              body.sendOnAbsent              ?? true,
      sendOnLate:                body.sendOnLate                ?? true,
      sendOnExcused:             body.sendOnExcused             ?? false,
      allowResendOnStatusChange: body.allowResendOnStatusChange ?? false,
      quietHoursEnabled:         body.quietHoursEnabled         ?? true,
      quietHoursStart:           body.quietHoursStart           ?? "21:00",
      quietHoursEnd:             body.quietHoursEnd             ?? "08:00",
    },
    update: {
      ...(body.alimtalkEnabled           !== undefined ? { alimtalkEnabled: body.alimtalkEnabled }                     : {}),
      ...(body.sendOnAbsent              !== undefined ? { sendOnAbsent: body.sendOnAbsent }                           : {}),
      ...(body.sendOnLate                !== undefined ? { sendOnLate: body.sendOnLate }                               : {}),
      ...(body.sendOnExcused             !== undefined ? { sendOnExcused: body.sendOnExcused }                         : {}),
      ...(body.allowResendOnStatusChange !== undefined ? { allowResendOnStatusChange: body.allowResendOnStatusChange } : {}),
      ...(body.quietHoursEnabled         !== undefined ? { quietHoursEnabled: body.quietHoursEnabled }                 : {}),
      ...(body.quietHoursStart           !== undefined ? { quietHoursStart: body.quietHoursStart }                     : {}),
      ...(body.quietHoursEnd             !== undefined ? { quietHoursEnd: body.quietHoursEnd }                         : {}),
    },
  });

  await audit({
    actorUserId: ctx.user.sub,
    academyId,
    action:      "notificationSettings.upsert",
    targetType:  "AcademyNotificationSettings",
    targetId:    settings.id,
    metaJson:    body as Record<string, unknown>,
  });

  return ok(settings);
}
