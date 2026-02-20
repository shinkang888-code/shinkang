/**
 * PATCH /api/academy/sessions/[sessionId]
 * Update session status (SCHEDULED | CANCELED | COMPLETED).
 * ADMIN / SUPER_ADMIN may update any session.
 * TEACHER may only update sessions for their own classes.
 */
import { type NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { updateSessionSchema } from "@/lib/validators/attendance";

interface Params { params: Promise<{ sessionId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "TEACHER", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { sessionId } = await params;
  const academyId = ctx.academyId!;

  const session = await prisma.classSession.findFirst({
    where:   { id: sessionId, academyId },
    include: { class: { select: { teacherUserId: true } } },
  });
  if (!session) return err("Session not found", 404);

  // TEACHER can only update their own class sessions
  if (
    ctx.user.role === "TEACHER" &&
    session.class.teacherUserId !== ctx.user.sub
  ) {
    return err("Forbidden", 403);
  }

  const body = await parseBody(req, updateSessionSchema);
  if (body instanceof Response) return body;

  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data:  { status: body.status },
  });

  return ok(updated);
}
