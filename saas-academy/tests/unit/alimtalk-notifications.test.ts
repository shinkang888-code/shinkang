/**
 * tests/unit/alimtalk-notifications.test.ts
 *
 * Unit/integration tests for the Kakao AlimTalk notification system.
 *
 * Tests (no HTTP server required – use service layer + real DB):
 *  1. quiet-hours: isInQuietHours correctly detects cross-midnight window
 *  2. quiet-hours: nextQuietHoursEnd returns future Date
 *  3. dedup: enqueueAttendanceNotification skips if already SENT
 *  4. policy: sendOnAbsent=false → skip
 *  5. policy: alimtalkEnabled=false → skip
 *  6. no opted-in contacts → skip with reason
 *  7. full happy path: creates NotificationQueue row(s)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma }       from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import {
  isInQuietHours,
  nextQuietHoursEnd,
}                       from "@/lib/alimtalk/quiet-hours";
import { enqueueAttendanceNotification } from "@/lib/alimtalk/attendance-notifier";

// ── Test fixture helpers ──────────────────────────────────────────────────────

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── 1 & 2. Quiet hours unit tests (pure logic, no DB) ────────────────────────

describe("isInQuietHours", () => {
  it("detects cross-midnight quiet window (21:00–08:00)", () => {
    const insideCases = [
      new Date("2024-01-15T23:00:00+09:00"), // 23:00 KST
      new Date("2024-01-16T01:30:00+09:00"), // 01:30 KST
      new Date("2024-01-16T07:59:00+09:00"), // 07:59 KST
    ];
    const outsideCases = [
      new Date("2024-01-15T08:01:00+09:00"), // 08:01 KST
      new Date("2024-01-15T12:00:00+09:00"), // 12:00 KST
      new Date("2024-01-15T20:59:00+09:00"), // 20:59 KST
    ];

    for (const d of insideCases) {
      expect(isInQuietHours("21:00", "08:00", d)).toBe(true);
    }
    for (const d of outsideCases) {
      expect(isInQuietHours("21:00", "08:00", d)).toBe(false);
    }
  });

  it("detects same-day quiet window (09:00–17:00)", () => {
    const inside  = new Date("2024-01-15T13:00:00+09:00"); // 13:00 KST
    const outside = new Date("2024-01-15T18:00:00+09:00"); // 18:00 KST

    expect(isInQuietHours("09:00", "17:00", inside)).toBe(true);
    expect(isInQuietHours("09:00", "17:00", outside)).toBe(false);
  });

  it("returns false for zero-length window (start == end)", () => {
    const now = new Date("2024-01-15T10:00:00+09:00");
    expect(isInQuietHours("10:00", "10:00", now)).toBe(false);
  });
});

describe("nextQuietHoursEnd", () => {
  it("returns a future Date for the quiet-end time", () => {
    // Use a known 'now' inside the quiet window (22:00 KST)
    const now  = new Date("2024-01-15T13:00:00Z"); // 22:00 KST
    const end  = nextQuietHoursEnd("08:00", now);
    expect(end > now).toBe(true);
  });
});

// ── Integration tests (require DB) ───────────────────────────────────────────

describe("enqueueAttendanceNotification – integration", () => {
  // Fixture IDs unique per test run
  const academyId   = makeId("acad");
  const teacherId   = makeId("teacher");
  const studentId   = makeId("student");
  const classId     = makeId("class");
  const sessionId   = makeId("session");
  let   attendanceId: string;

  // Create minimal fixture data
  beforeAll(async () => {
    const pw = await hashPassword("Test1234!");

    await prisma.academy.create({
      data: { id: academyId, name: "Test Academy", code: makeId("CODE") },
    });

    await prisma.user.createMany({
      data: [
        {
          id: teacherId, academyId, role: "TEACHER",
          name: "Test Teacher", email: makeId("teacher") + "@test.com",
          passwordHash: pw,
        },
        {
          id: studentId, academyId, role: "STUDENT",
          name: "Test Student", email: makeId("student") + "@test.com",
          passwordHash: pw,
        },
      ],
    });

    await prisma.class.create({
      data: {
        id: classId, academyId, name: "피아노 초급",
        teacherUserId: teacherId, status: "ACTIVE",
        startDate: new Date(),
      },
    });

    const startsAt = new Date("2024-06-01T10:00:00+09:00"); // 10:00 KST
    await prisma.classSession.create({
      data: {
        id: sessionId, academyId, classId,
        startsAt,
        endsAt:    new Date(startsAt.getTime() + 60 * 60_000),
        localDate: "2024-06-01",
        status:    "SCHEDULED",
      },
    });

    const att = await prisma.attendance.create({
      data: {
        academyId, sessionId, classId,
        studentUserId:  studentId,
        status:         "ABSENT",
        markedAt:       new Date(),
        markedByUserId: teacherId,
      },
    });
    attendanceId = att.id;
  });

  afterAll(async () => {
    // Clean up in reverse FK order
    await prisma.notificationQueue.deleteMany({ where: { academyId } });
    await prisma.parentContact.deleteMany({ where: { academyId } });
    await prisma.alimtalkTemplate.deleteMany({ where: { academyId } });
    await prisma.academyNotificationSettings.deleteMany({ where: { academyId } });
    await prisma.attendance.deleteMany({ where: { academyId } });
    await prisma.classSession.deleteMany({ where: { academyId } });
    await prisma.classEnrollment.deleteMany({ where: { academyId } });
    await prisma.class.deleteMany({ where: { academyId } });
    await prisma.user.deleteMany({ where: { academyId } });
    await prisma.academy.delete({ where: { id: academyId } }).catch(() => {});
  });

  // Reset notification-related data between tests
  beforeEach(async () => {
    await prisma.notificationQueue.deleteMany({ where: { academyId } });
    await prisma.parentContact.deleteMany({ where: { academyId } });
    await prisma.alimtalkTemplate.deleteMany({ where: { academyId } });
    await prisma.academyNotificationSettings.deleteMany({ where: { academyId } });
  });

  // ── Test 3: alimtalkEnabled=false → skip ─────────────────────────────────

  it("skips when alimtalkEnabled=false", async () => {
    await prisma.academyNotificationSettings.create({
      data: { academyId, alimtalkEnabled: false },
    });

    const result = await enqueueAttendanceNotification({ attendanceId });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("disabled");
    expect(result.queueIds).toHaveLength(0);
  });

  // ── Test 4: sendOnAbsent=false → skip ────────────────────────────────────

  it("skips when sendOnAbsent=false", async () => {
    await prisma.academyNotificationSettings.create({
      data: { academyId, alimtalkEnabled: true, sendOnAbsent: false },
    });
    await prisma.alimtalkTemplate.create({
      data: { academyId, type: "ABSENT", templateCode: "TM_ABSENT", senderKey: "SK_TEST" },
    });

    const result = await enqueueAttendanceNotification({ attendanceId });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("sendOnAbsent");
  });

  // ── Test 5: no opted-in contacts → skip ──────────────────────────────────

  it("skips when no opted-in parent contacts exist", async () => {
    await prisma.academyNotificationSettings.create({
      data: { academyId, alimtalkEnabled: true, sendOnAbsent: true },
    });
    await prisma.alimtalkTemplate.create({
      data: { academyId, type: "ABSENT", templateCode: "TM_ABSENT", senderKey: "SK_TEST" },
    });
    // No parent contacts created → expect skip
    const result = await enqueueAttendanceNotification({ attendanceId });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("opted-in");
  });

  // ── Test 6: dedup – already SENT → skip ──────────────────────────────────

  it("skips dedup when a SENT queue row already exists for same attendanceId+status", async () => {
    await prisma.academyNotificationSettings.create({
      data: { academyId, alimtalkEnabled: true, sendOnAbsent: true, allowResendOnStatusChange: false },
    });
    await prisma.alimtalkTemplate.create({
      data: { academyId, type: "ABSENT", templateCode: "TM_ABSENT", senderKey: "SK_TEST" },
    });
    await prisma.parentContact.create({
      data: {
        academyId, studentUserId: studentId,
        name: "Test Parent", phone: "01011112222",
        notificationOptIn: true, consentRecordedAt: new Date(),
      },
    });

    // Pre-insert a SENT queue row
    await prisma.notificationQueue.create({
      data: {
        academyId,
        channel:         "KAKAO_ALIMTALK",
        eventType:       "ATTENDANCE",
        attendanceId,
        attendanceStatus: "ABSENT",
        studentUserId:   studentId,
        recipientPhone:  "01011112222",
        templateCode:    "TM_ABSENT",
        senderKey:       "SK_TEST",
        templateVarsJson: {},
        status:          "SENT",
        nextRetryAt:     new Date(),
        scheduledAt:     new Date(),
      },
    });

    const result = await enqueueAttendanceNotification({ attendanceId });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("dedup");
  });

  // ── Test 7: happy path – creates queue rows ───────────────────────────────

  it("creates NotificationQueue rows for each opted-in contact", async () => {
    await prisma.academyNotificationSettings.create({
      data: {
        academyId,
        alimtalkEnabled:   true,
        sendOnAbsent:      true,
        quietHoursEnabled: false, // disable quiet hours for this test
      },
    });
    await prisma.alimtalkTemplate.create({
      data: { academyId, type: "ABSENT", templateCode: "TM_ABSENT", senderKey: "SK_TEST" },
    });
    await prisma.parentContact.createMany({
      data: [
        {
          academyId, studentUserId: studentId,
          name: "어머니", phone: "01011112222",
          notificationOptIn: true, consentRecordedAt: new Date(), relationship: "MOTHER",
        },
        {
          academyId, studentUserId: studentId,
          name: "아버지", phone: "01033334444",
          notificationOptIn: true, consentRecordedAt: new Date(), relationship: "FATHER",
        },
        {
          // NOT opted in – should be excluded
          academyId, studentUserId: studentId,
          name: "기타", phone: "01055556666",
          notificationOptIn: false, relationship: "ETC",
        },
      ],
    });

    const result = await enqueueAttendanceNotification({ attendanceId });

    expect(result.skipped).toBe(false);
    expect(result.queueIds).toHaveLength(2); // 2 opted-in contacts

    // Verify DB rows
    const rows = await prisma.notificationQueue.findMany({
      where: { attendanceId },
      orderBy: { recipientPhone: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].templateCode).toBe("TM_ABSENT");
    expect(rows[0].status).toBe("PENDING");
    expect(rows.map((r) => r.recipientPhone).sort()).toEqual(["01011112222", "01033334444"].sort());

    // Template vars should be populated
    const vars = rows[0].templateVarsJson as Record<string, string>;
    expect(vars.studentName).toBe("Test Student");
    expect(vars.statusText).toBe("결석");
  });
});
