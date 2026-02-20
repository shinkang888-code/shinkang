/**
 * GET /api/academy/sessions/[sessionId]/attendance
 *   – list attendance for a session (with enrolled-but-missing students)
 *
 * PUT /api/academy/sessions/[sessionId]/attendance
 *   – bulk upsert attendance for a session; logs AttendanceHistory for edits;
 *     fires Kakao AlimTalk notifications for ABSENT/LATE/EXCUSED statuses.
 *
 * Allowed: ADMIN, TEACHER (own classes only), SUPER_ADMIN
 */
import { type NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { bulkAttendanceSchema } from "@/lib/validators/attendance";
import { enqueueAttendanceNotification } from "@/lib/alimtalk/attendance-notifier";

interface Params { params: Promise<{ sessionId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "TEACHER", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { sessionId } = await params;
  const academyId = ctx.academyId!;

  const session = await prisma.classSession.findFirst({
    where:   { id: sessionId, academyId },
    include: { class: { select: { id: true, name: true, teacherUserId: true } } },
  });
  if (!session) return err("Session not found", 404);

  if (
    ctx.user.role === "TEACHER" &&
    session.class.teacherUserId !== ctx.user.sub
  ) {
    return err("Forbidden", 403);
  }

  // All ACTIVE enrollments for this class
  const enrollments = await prisma.classEnrollment.findMany({
    where:   { classId: session.classId, academyId, status: "ACTIVE" },
    include: { student: { select: { id: true, name: true, email: true } } },
  });

  // Existing attendance records
  const attendances = await prisma.attendance.findMany({
    where:   { sessionId, academyId },
    include: { student: { select: { id: true, name: true, email: true } } },
  });

  const attendanceMap = new Map(attendances.map((a) => [a.studentUserId, a]));

  // Merge: enrolled students + their current attendance (or null)
  const result = enrollments.map((e) => ({
    enrollment: { id: e.id, status: e.status },
    student:    e.student,
    attendance: attendanceMap.get(e.studentUserId) ?? null,
  }));

  return ok({ session, entries: result });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const ctx = await guardRoute(req, ["ADMIN", "TEACHER", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { sessionId } = await params;
  const academyId = ctx.academyId!;

  const session = await prisma.classSession.findFirst({
    where:   { id: sessionId, academyId },
    include: { class: { select: { id: true, teacherUserId: true } } },
  });
  if (!session) return err("Session not found", 404);
  if (session.status === "CANCELED") {
    return err("Cannot mark attendance for a canceled session", 400);
  }

  if (
    ctx.user.role === "TEACHER" &&
    session.class.teacherUserId !== ctx.user.sub
  ) {
    return err("Forbidden", 403);
  }

  const body = await parseBody(req, bulkAttendanceSchema);
  if (body instanceof Response) return body;

  // Verify all students are enrolled (ACTIVE) in this class
  const studentIds = body.entries.map((e) => e.studentUserId);
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      academyId,
      classId:       session.classId,
      studentUserId: { in: studentIds },
      status:        "ACTIVE",
    },
    select: { studentUserId: true },
  });
  const enrolledSet = new Set(enrollments.map((e) => e.studentUserId));
  const notEnrolled = studentIds.filter((id) => !enrolledSet.has(id));
  if (notEnrolled.length > 0) {
    return err("Some students are not actively enrolled in this class", 422, { notEnrolled });
  }

  // Fetch existing attendance for history logging + dedup
  const existing = await prisma.attendance.findMany({
    where: { sessionId, academyId, studentUserId: { in: studentIds } },
  });
  const existingMap = new Map(existing.map((a) => [a.studentUserId, a]));

  const now      = new Date();
  const upserted: Array<{ id: string; studentUserId: string; status: string; isNew: boolean; statusChanged: boolean }> = [];

  const historyRows: Array<{
    academyId:    string;
    attendanceId: string;
    editorUserId: string;
    beforeJson:   object;
    afterJson:    object;
    reason:       string | null;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const entry of body.entries) {
      const prev = existingMap.get(entry.studentUserId);

      const record = await tx.attendance.upsert({
        where: {
          academyId_sessionId_studentUserId: {
            academyId,
            sessionId,
            studentUserId: entry.studentUserId,
          },
        },
        update: {
          status:        entry.status,
          memo:          entry.memo ?? null,
          markedAt:      now,
          markedByUserId: ctx.user.sub,
          updatedReason: entry.reason ?? null,
        },
        create: {
          academyId,
          sessionId,
          classId:       session.classId,
          studentUserId: entry.studentUserId,
          status:        entry.status,
          memo:          entry.memo ?? null,
          markedAt:      now,
          markedByUserId: ctx.user.sub,
        },
      });

      const isNew          = !prev;
      const statusChanged  = !!prev && prev.status !== entry.status;

      upserted.push({
        id:            record.id,
        studentUserId: entry.studentUserId,
        status:        entry.status,
        isNew,
        statusChanged,
      });

      // Log history only for edits where something changed
      if (prev && (statusChanged || prev.memo !== (entry.memo ?? null))) {
        historyRows.push({
          academyId,
          attendanceId:  record.id,
          editorUserId:  ctx.user.sub,
          beforeJson:    { status: prev.status, memo: prev.memo },
          afterJson:     { status: entry.status, memo: entry.memo ?? null },
          reason:        entry.reason ?? null,
        });
      }
    }

    if (historyRows.length > 0) {
      await tx.attendanceHistory.createMany({ data: historyRows });
    }

    // Auto-complete the session if it was SCHEDULED and all enrolled students are marked
    if (session.status === "SCHEDULED") {
      const totalEnrolled = await tx.classEnrollment.count({
        where: { classId: session.classId, academyId, status: "ACTIVE" },
      });
      const markedCount = await tx.attendance.count({
        where: { sessionId, academyId },
      });
      if (markedCount >= totalEnrolled) {
        await tx.classSession.update({
          where: { id: sessionId },
          data:  { status: "COMPLETED" },
        });
      }
    }
  });

  // ── Fire AlimTalk notifications (outside transaction, fire-and-forget) ─────
  // Only trigger for statuses that warrant a notification, and only when:
  //   - The record is new, OR
  //   - The status changed (allowResendOnStatusChange handled inside notifier)
  const notifyStatuses = new Set(["ABSENT", "LATE", "EXCUSED"]);

  const notificationResults = await Promise.allSettled(
    upserted
      .filter((r) => notifyStatuses.has(r.status) && (r.isNew || r.statusChanged))
      .map((r) =>
        enqueueAttendanceNotification({
          attendanceId: r.id,
          actorUserId:  ctx.user.sub,
        }),
      ),
  );

  const notifQueued = notificationResults.filter(
    (r) => r.status === "fulfilled" && !r.value.skipped,
  ).length;

  return ok({
    updated:       upserted.length,
    historyLogged: historyRows.length,
    notifQueued,
  });
}
