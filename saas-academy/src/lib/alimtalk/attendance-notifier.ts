/**
 * src/lib/alimtalk/attendance-notifier.ts
 *
 * Core service: enqueue AlimTalk notifications when attendance is marked.
 *
 * Flow:
 *  1. Load academy notification settings – bail if disabled.
 *  2. Check sendOnAbsent / sendOnLate / sendOnExcused policy.
 *  3. Dedup: if (attendanceId, attendanceStatus) already has a SENT/PENDING
 *     queue row → skip (unless allowResendOnStatusChange=true).
 *  4. Load active ParentContacts with notificationOptIn=true.
 *  5. Check quiet hours → if inside, set scheduledAt to quietEnd.
 *  6. Load matching AlimtalkTemplate (ABSENT/LATE/EXCUSED).
 *  7. Insert NotificationQueue rows (one per parent contact).
 *  8. Return list of queue IDs created.
 */

import { prisma } from "@/lib/db/client";
import { audit }  from "@/lib/auth/audit";
import {
  buildAttendanceVars,
  STATUS_LABEL,
  toKSTDateString,
  toKSTTimeString,
} from "@/lib/alimtalk/templates";
import { isInQuietHours, nextQuietHoursEnd } from "@/lib/alimtalk/quiet-hours";
import type {
  AlimtalkTemplateType,
  NotificationQueueStatus,
} from "@prisma/client";

// Map Attendance status → AlimtalkTemplateType
const STATUS_TO_TEMPLATE_TYPE: Record<string, AlimtalkTemplateType | null> = {
  ABSENT:  "ABSENT",
  LATE:    "LATE",
  EXCUSED: "EXCUSED",
  PRESENT: null,
};

export interface EnqueueAttendanceNotificationParams {
  attendanceId:  string;
  actorUserId?:  string; // teacher/admin who marked attendance
}

export interface EnqueueResult {
  skipped:   boolean;
  reason?:   string;
  queueIds:  string[];
}

/**
 * Main entry point – call this after upserting an Attendance row.
 * Idempotent: safe to call multiple times for the same attendanceId.
 */
export async function enqueueAttendanceNotification(
  params: EnqueueAttendanceNotificationParams,
): Promise<EnqueueResult> {
  const { attendanceId, actorUserId } = params;

  // ── 1. Load attendance with all context ────────────────────────────────────
  const attendance = await prisma.attendance.findUnique({
    where:   { id: attendanceId },
    include: {
      session: {
        include: { class: { include: { teacher: true } } },
      },
    },
  });

  if (!attendance) {
    return { skipped: true, reason: "Attendance not found", queueIds: [] };
  }

  const { academyId, studentUserId, status: attendanceStatus } = attendance;
  const session = attendance.session;

  // ── 2. Only trigger for SCHEDULED sessions ─────────────────────────────────
  if (session.status !== "SCHEDULED" && session.status !== "COMPLETED") {
    return {
      skipped: true,
      reason:  `Session status is ${session.status} – no notification`,
      queueIds: [],
    };
  }

  // ── 3. Resolve template type ───────────────────────────────────────────────
  const templateType = STATUS_TO_TEMPLATE_TYPE[attendanceStatus] ?? null;
  if (!templateType) {
    return {
      skipped: true,
      reason:  `Status ${attendanceStatus} does not trigger notification`,
      queueIds: [],
    };
  }

  // ── 4. Load academy notification settings ──────────────────────────────────
  const settings = await prisma.academyNotificationSettings.findUnique({
    where: { academyId },
  });

  if (!settings?.alimtalkEnabled) {
    return { skipped: true, reason: "AlimTalk disabled for academy", queueIds: [] };
  }

  // Policy check
  if (attendanceStatus === "ABSENT"  && !settings.sendOnAbsent)  {
    return { skipped: true, reason: "sendOnAbsent=false", queueIds: [] };
  }
  if (attendanceStatus === "LATE"    && !settings.sendOnLate)    {
    return { skipped: true, reason: "sendOnLate=false", queueIds: [] };
  }
  if (attendanceStatus === "EXCUSED" && !settings.sendOnExcused) {
    return { skipped: true, reason: "sendOnExcused=false", queueIds: [] };
  }

  // ── 5. Dedup check ─────────────────────────────────────────────────────────
  const existingQueue = await prisma.notificationQueue.findFirst({
    where: {
      attendanceId,
      attendanceStatus,
      status: { in: ["PENDING", "PROCESSING", "SENT"] as NotificationQueueStatus[] },
    },
  });

  if (existingQueue && !settings.allowResendOnStatusChange) {
    return {
      skipped: true,
      reason:  `Already queued/sent (id=${existingQueue.id}) – dedup skip`,
      queueIds: [],
    };
  }

  // ── 6. Load parent contacts with opt-in ────────────────────────────────────
  const contacts = await prisma.parentContact.findMany({
    where: {
      academyId,
      studentUserId,
      notificationOptIn: true,
      status: "ACTIVE",
    },
  });

  if (contacts.length === 0) {
    return {
      skipped: true,
      reason:  "No opted-in parent contacts",
      queueIds: [],
    };
  }

  // ── 7. Load AlimTalk template ──────────────────────────────────────────────
  const template = await prisma.alimtalkTemplate.findFirst({
    where: { academyId, type: templateType, isActive: true },
  });

  if (!template) {
    return {
      skipped: true,
      reason:  `No active ${templateType} template for academy`,
      queueIds: [],
    };
  }

  // ── 8. Load supporting data ────────────────────────────────────────────────
  const [academy, student] = await Promise.all([
    prisma.academy.findUnique({ where: { id: academyId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: studentUserId }, select: { name: true } }),
  ]);

  const teacherName = session.class.teacher?.name ?? "선생님";
  const className   = session.class.name;
  const sessionDate = toKSTDateString(session.startsAt);
  const sessionTime = toKSTTimeString(session.startsAt);
  const statusText  = STATUS_LABEL[attendanceStatus] ?? attendanceStatus;

  const templateVars = buildAttendanceVars({
    academyName: academy?.name ?? "",
    studentName: student?.name ?? "",
    className,
    sessionDate,
    sessionTime,
    statusText,
    teacherName,
  });

  // ── 9. Quiet hours check ───────────────────────────────────────────────────
  const now = new Date();
  let scheduledAt: Date | undefined;

  if (
    settings.quietHoursEnabled &&
    isInQuietHours(settings.quietHoursStart, settings.quietHoursEnd, now)
  ) {
    scheduledAt = nextQuietHoursEnd(settings.quietHoursEnd, now);
  }

  // ── 10. Insert queue rows ──────────────────────────────────────────────────
  const queueIds: string[] = [];

  for (const contact of contacts) {
    const row = await prisma.notificationQueue.create({
      data: {
        academyId,
        channel:         "KAKAO_ALIMTALK",
        eventType:       "ATTENDANCE",
        attendanceId,
        attendanceStatus,
        studentUserId,
        parentContactId: contact.id,
        recipientPhone:  contact.phone,
        templateCode:    template.templateCode,
        senderKey:       template.senderKey,
        templateVarsJson: templateVars,
        status:          "PENDING",
        scheduledAt:     scheduledAt ?? now,
        nextRetryAt:     scheduledAt ?? now,
      },
    });
    queueIds.push(row.id);
  }

  // ── 11. Audit log ──────────────────────────────────────────────────────────
  await audit({
    actorUserId: actorUserId ?? null,
    academyId,
    action:      "attendance.notification.queued",
    targetType:  "Attendance",
    targetId:    attendanceId,
    metaJson: {
      attendanceStatus,
      templateType,
      queueIds,
      contactCount: contacts.length,
    },
  });

  return { skipped: false, queueIds };
}
