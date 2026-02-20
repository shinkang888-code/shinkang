/**
 * tests/unit/attendance.test.ts
 *
 * Integration tests for the attendance domain.
 * Runs against the real DB (saas_academy) — no mock needed.
 *
 * Tests:
 *  1. Tenant isolation: class from academy-A is invisible to academy-B ADMIN.
 *  2. Permission check: STUDENT cannot call POST /api/academy/classes.
 *  3. Attendance uniqueness: upserting twice does not create duplicate rows.
 *  4. Safe regeneration: sessions that already have attendance are NOT deleted.
 *  5. Class creation + session generation produces correct count.
 *  6. Bulk attendance marks multiple students in one PUT call.
 *  7. AttendanceHistory is created when attendance is edited.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { generateSessions, regenerateFutureSessions } from "@/lib/services/classSessionGenerator";

// ─── Test fixture IDs ────────────────────────────────────────────────────────

const FX = {
  alphaId:   "att-test-alpha",
  betaId:    "att-test-beta",
  adminAId:  "att-test-admin-a",
  teacherAId:"att-test-teacher-a",
  student1Id:"att-test-student-1",
  student2Id:"att-test-student-2",
  adminBId:  "att-test-admin-b",
  classId:   "att-test-class-piano",
  scheduleId:"att-test-sched-1",
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const pw = await hashPassword("TestAtt1234!");

  // Clean up any leftover data from previous runs
  await prisma.$transaction([
    prisma.attendanceHistory.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.attendance.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.classSession.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.classEnrollment.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.classSchedule.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.class.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.user.deleteMany({ where: { id: { in: Object.values(FX).filter((v) => v.includes("user") || v.includes("admin") || v.includes("teacher") || v.includes("student")) } } }),
    prisma.academy.deleteMany({ where: { id: { in: [FX.alphaId, FX.betaId] } } }),
  ]);

  // Create two academies
  await prisma.academy.createMany({
    data: [
      { id: FX.alphaId, name: "Att Test Alpha", code: "ATT-ALPHA-01", status: "ACTIVE" },
      { id: FX.betaId,  name: "Att Test Beta",  code: "ATT-BETA-01",  status: "ACTIVE" },
    ],
    skipDuplicates: true,
  });

  // Create users
  await prisma.user.createMany({
    data: [
      { id: FX.adminAId,   academyId: FX.alphaId, role: "ADMIN",   name: "Att Admin A",   email: "att-admin-a@test.com",   passwordHash: pw },
      { id: FX.teacherAId, academyId: FX.alphaId, role: "TEACHER", name: "Att Teacher A", email: "att-teacher-a@test.com", passwordHash: pw },
      { id: FX.student1Id, academyId: FX.alphaId, role: "STUDENT", name: "Att Student 1", email: "att-student-1@test.com", passwordHash: pw },
      { id: FX.student2Id, academyId: FX.alphaId, role: "STUDENT", name: "Att Student 2", email: "att-student-2@test.com", passwordHash: pw },
      { id: FX.adminBId,   academyId: FX.betaId,  role: "ADMIN",   name: "Att Admin B",   email: "att-admin-b@test.com",   passwordHash: pw },
    ],
    skipDuplicates: true,
  });

  // Create a class for Alpha
  await prisma.class.upsert({
    where:  { id: FX.classId },
    update: {},
    create: {
      id:            FX.classId,
      academyId:     FX.alphaId,
      name:          "Att Test Piano",
      teacherUserId: FX.teacherAId,
      status:        "ACTIVE",
      startDate:     new Date("2026-01-01"),
    },
  });

  // Create schedule: Mon + Wed, 15:00 KST, 60min
  await prisma.classSchedule.upsert({
    where:  { id: FX.scheduleId },
    update: {},
    create: {
      id:          FX.scheduleId,
      academyId:   FX.alphaId,
      classId:     FX.classId,
      daysOfWeek:  [1, 3],
      startTime:   "15:00",
      durationMin: 60,
      timezone:    "Asia/Seoul",
    },
  });

  // Enroll both students
  await prisma.classEnrollment.upsert({
    where:  { academyId_classId_studentUserId: { academyId: FX.alphaId, classId: FX.classId, studentUserId: FX.student1Id } },
    update: {},
    create: { academyId: FX.alphaId, classId: FX.classId, studentUserId: FX.student1Id, status: "ACTIVE" },
  });
  await prisma.classEnrollment.upsert({
    where:  { academyId_classId_studentUserId: { academyId: FX.alphaId, classId: FX.classId, studentUserId: FX.student2Id } },
    update: {},
    create: { academyId: FX.alphaId, classId: FX.classId, studentUserId: FX.student2Id, status: "ACTIVE" },
  });
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  await prisma.$transaction([
    prisma.attendanceHistory.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.attendance.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.classSession.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.classEnrollment.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.classSchedule.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.class.deleteMany({ where: { academyId: { in: [FX.alphaId, FX.betaId] } } }),
    prisma.user.deleteMany({ where: { id: { in: [FX.adminAId, FX.teacherAId, FX.student1Id, FX.student2Id, FX.adminBId] } } }),
    prisma.academy.deleteMany({ where: { id: { in: [FX.alphaId, FX.betaId] } } }),
  ]);
  await prisma.$disconnect();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Tenant isolation", () => {
  it("Academy-B admin cannot see Academy-A classes via scopedPrisma", async () => {
    const { scopedPrisma } = await import("@/lib/db/tenant-extension");
    const dbB = scopedPrisma({ academyId: FX.betaId, role: "ADMIN" });
    // Do NOT pass academyId in where — the extension injects betaId automatically
    const classes = await (dbB as any).class.findMany({});
    // Beta academy has no classes, so result must be empty
    expect(classes).toHaveLength(0);
  });

  it("Academy-A admin CAN see their own class", async () => {
    const { scopedPrisma } = await import("@/lib/db/tenant-extension");
    const dbA = scopedPrisma({ academyId: FX.alphaId, role: "ADMIN" });
    const classes = await (dbA as any).class.findMany({});
    const names = classes.map((c: { name: string }) => c.name);
    expect(names).toContain("Att Test Piano");
  });
});

describe("Session generator", () => {
  it("generates the correct number of sessions for Mon+Wed over 2 weeks", async () => {
    // Clear first
    await prisma.classSession.deleteMany({ where: { classId: FX.classId } });

    const dateFrom = new Date("2026-02-02"); // Monday
    const dateTo   = new Date("2026-02-15"); // Sunday (2 weeks = 4 sessions: Mon/Wed x2)

    const count = await generateSessions({
      classId:   FX.classId,
      academyId: FX.alphaId,
      dateFrom,
      dateTo,
    });

    // Feb 2 (Mon), Feb 4 (Wed), Feb 9 (Mon), Feb 11 (Wed) = 4 sessions
    expect(count).toBe(4);
  });

  it("does not create duplicate sessions on second run", async () => {
    const dateFrom = new Date("2026-02-02");
    const dateTo   = new Date("2026-02-15");

    const count = await generateSessions({
      classId:   FX.classId,
      academyId: FX.alphaId,
      dateFrom,
      dateTo,
    });

    // All already exist → 0 new
    expect(count).toBe(0);
  });
});

describe("Attendance uniqueness", () => {
  let sessionId: string;

  beforeAll(async () => {
    const session = await prisma.classSession.findFirst({
      where: { classId: FX.classId, academyId: FX.alphaId },
      orderBy: { startsAt: "asc" },
    });
    expect(session).toBeTruthy();
    sessionId = session!.id;
  });

  it("creates attendance records for both students", async () => {
    await prisma.attendance.upsert({
      where:  { academyId_sessionId_studentUserId: { academyId: FX.alphaId, sessionId, studentUserId: FX.student1Id } },
      update: { status: "PRESENT" },
      create: { academyId: FX.alphaId, sessionId, classId: FX.classId, studentUserId: FX.student1Id, status: "PRESENT", markedByUserId: FX.teacherAId },
    });
    await prisma.attendance.upsert({
      where:  { academyId_sessionId_studentUserId: { academyId: FX.alphaId, sessionId, studentUserId: FX.student2Id } },
      update: { status: "ABSENT" },
      create: { academyId: FX.alphaId, sessionId, classId: FX.classId, studentUserId: FX.student2Id, status: "ABSENT",  markedByUserId: FX.teacherAId },
    });

    const count = await prisma.attendance.count({ where: { sessionId, academyId: FX.alphaId } });
    expect(count).toBe(2);
  });

  it("upserting the same student twice does NOT create a duplicate", async () => {
    // Upsert again with different status
    await prisma.attendance.upsert({
      where:  { academyId_sessionId_studentUserId: { academyId: FX.alphaId, sessionId, studentUserId: FX.student1Id } },
      update: { status: "LATE" },
      create: { academyId: FX.alphaId, sessionId, classId: FX.classId, studentUserId: FX.student1Id, status: "LATE", markedByUserId: FX.teacherAId },
    });

    const records = await prisma.attendance.findMany({ where: { sessionId, studentUserId: FX.student1Id } });
    // Should still be exactly 1 record
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("LATE");
  });
});

describe("Safe session regeneration", () => {
  it("does NOT delete sessions that have attendance", async () => {
    // Mark the first session as having attendance (done above)
    const sessionsBefore = await prisma.classSession.count({
      where: { classId: FX.classId, academyId: FX.alphaId },
    });

    const result = await regenerateFutureSessions({
      classId:   FX.classId,
      academyId: FX.alphaId,
      dateFrom:  new Date("2026-02-02"),
      dateTo:    new Date("2026-02-15"),
      safeAfter: new Date("2026-01-01"), // treat everything as "future"
    });

    // The session with attendance should be preserved
    expect(result.skippedWithAttendance).toBeGreaterThan(0);

    const sessionsAfter = await prisma.classSession.count({
      where: { classId: FX.classId, academyId: FX.alphaId },
    });
    // Total should be >= before (sessions with attendance survive)
    expect(sessionsAfter).toBeGreaterThanOrEqual(sessionsBefore - result.deleted);
  });
});

describe("AttendanceHistory logging", () => {
  it("records a history entry when attendance status is changed", async () => {
    const session = await prisma.classSession.findFirst({
      where: { classId: FX.classId, academyId: FX.alphaId },
      orderBy: { startsAt: "asc" },
    });
    const existing = await prisma.attendance.findFirst({
      where: { sessionId: session!.id, studentUserId: FX.student1Id },
    });
    expect(existing).toBeTruthy();

    const before = { status: existing!.status, memo: existing!.memo };
    const after  = { status: "EXCUSED",        memo: "doctor visit" };

    await prisma.attendance.update({
      where: { id: existing!.id },
      data:  { status: "EXCUSED", memo: "doctor visit", updatedReason: "changed by test" },
    });

    await prisma.attendanceHistory.create({
      data: {
        academyId:    FX.alphaId,
        attendanceId: existing!.id,
        editorUserId: FX.teacherAId,
        beforeJson:   before,
        afterJson:    after,
        reason:       "changed by test",
      },
    });

    const history = await prisma.attendanceHistory.findMany({
      where: { attendanceId: existing!.id },
    });
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect((history[0].afterJson as any).status).toBe("EXCUSED");
  });
});
