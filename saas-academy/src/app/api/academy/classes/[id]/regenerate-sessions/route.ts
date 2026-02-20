/**
 * POST /api/academy/classes/[id]/regenerate-sessions
 * Safely regenerate future ClassSessions for a class.
 *
 * Rules:
 *  - Only deletes SCHEDULED sessions after today with 0 attendance.
 *  - Keeps sessions that are CANCELED, COMPLETED, or have attendance.
 *  - Re-creates from the new schedule rules.
 *
 * Allowed: ADMIN, SUPER_ADMIN
 */
import { type NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { regenerateSessionsSchema } from "@/lib/validators/attendance";
import { regenerateFutureSessions } from "@/lib/services/classSessionGenerator";

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { id: classId } = await params;
  const academyId = ctx.academyId!;

  const cls = await prisma.class.findFirst({ where: { id: classId, academyId } });
  if (!cls) return err("Class not found", 404);

  const body = await parseBody(req, regenerateSessionsSchema);
  if (body instanceof Response) return body;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const dateFrom = body.dateFrom ? new Date(body.dateFrom) : today;
  const dateTo   = body.dateTo
    ? new Date(body.dateTo)
    : new Date(today.getTime() + body.weeks * 7 * 24 * 60 * 60 * 1000);

  // Respect class endDate if set
  const effectiveDateTo =
    cls.endDate && cls.endDate < dateTo ? cls.endDate : dateTo;

  const result = await regenerateFutureSessions({
    classId,
    academyId,
    dateFrom,
    dateTo:    effectiveDateTo,
    safeAfter: today,
  });

  return ok({
    deleted:               result.deleted,
    created:               result.created,
    skippedWithAttendance: result.skippedWithAttendance,
  });
}
