/**
 * prisma/seed.ts
 * Seeds: SUPER_ADMIN + two academies (Alpha/Beta) + users + billing fixtures
 *        + attendance domain (Class, ClassSchedule, ClassEnrollment, ClassSession, Attendance)
 * Run: npm run db:seed
 */
import {
  PrismaClient,
  UserRole,
  AcademyStatus,
  ClassStatus,
  EnrollmentStatus,
  SessionStatus,
  AttendanceStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const HASH_ROUNDS = 12;
const hash = (plain: string) => bcrypt.hash(plain, HASH_ROUNDS);

/** Returns a "YYYY-MM-DD" string for a given Date in Asia/Seoul timezone */
function toKSTDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** Adds `days` calendar days to a Date (UTC midnight) */
function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

async function main() {
  console.log("🌱  Seeding …");

  // ── SUPER_ADMIN ────────────────────────────────────────────────────────────
  const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? "super@admin.com";
  const superPw    = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin1234!";

  const superAdmin = await prisma.user.upsert({
    where:  { email: superEmail },
    update: {},
    create: {
      email:        superEmail,
      name:         "Super Admin",
      role:         UserRole.SUPER_ADMIN,
      passwordHash: await hash(superPw),
      academyId:    null,
    },
  });
  console.log(`✅  SUPER_ADMIN  ${superAdmin.email}`);

  // ── Academy A (ACTIVE) ────────────────────────────────────────────────────
  const academyA = await prisma.academy.upsert({
    where:  { code: "ALPHA-01" },
    update: {},
    create: { name: "Alpha Academy", code: "ALPHA-01", status: AcademyStatus.ACTIVE },
  });

  const adminA = await prisma.user.upsert({
    where:  { email: "admin@alpha.com" },
    update: {},
    create: {
      email:        "admin@alpha.com",
      name:         "Alpha Admin",
      role:         UserRole.ADMIN,
      passwordHash: await hash("Admin1234!"),
      academyId:    academyA.id,
    },
  });

  const teacherA = await prisma.user.upsert({
    where:  { email: "teacher@alpha.com" },
    update: {},
    create: {
      email:        "teacher@alpha.com",
      name:         "Alpha Teacher",
      role:         UserRole.TEACHER,
      passwordHash: await hash("Teacher1234!"),
      academyId:    academyA.id,
    },
  });

  const studentA = await prisma.user.upsert({
    where:  { email: "student@alpha.com" },
    update: {},
    create: {
      email:        "student@alpha.com",
      name:         "Alpha Student",
      role:         UserRole.STUDENT,
      passwordHash: await hash("Student1234!"),
      academyId:    academyA.id,
    },
  });

  const studentA2 = await prisma.user.upsert({
    where:  { email: "student2@alpha.com" },
    update: {},
    create: {
      email:        "student2@alpha.com",
      name:         "Alpha Student 2",
      role:         UserRole.STUDENT,
      passwordHash: await hash("Student1234!"),
      academyId:    academyA.id,
    },
  });

  console.log(`✅  Academy  ${academyA.name} (${academyA.code})`);
  console.log(`   └─ admin:${adminA.email}  teacher:${teacherA.email}  student:${studentA.email}`);

  // ── Academy B (SUSPENDED) ─────────────────────────────────────────────────
  const academyB = await prisma.academy.upsert({
    where:  { code: "BETA-01" },
    update: {},
    create: { name: "Beta Academy", code: "BETA-01", status: AcademyStatus.SUSPENDED },
  });

  const adminB = await prisma.user.upsert({
    where:  { email: "admin@beta.com" },
    update: {},
    create: {
      email:        "admin@beta.com",
      name:         "Beta Admin",
      role:         UserRole.ADMIN,
      passwordHash: await hash("Admin1234!"),
      academyId:    academyB.id,
    },
  });

  const studentB = await prisma.user.upsert({
    where:  { email: "student@beta.com" },
    update: {},
    create: {
      email:        "student@beta.com",
      name:         "Beta Student",
      role:         UserRole.STUDENT,
      passwordHash: await hash("Student1234!"),
      academyId:    academyB.id,
    },
  });

  console.log(`✅  Academy  ${academyB.name} (${academyB.code}) [SUSPENDED]`);
  console.log(`   └─ admin:${adminB.email}  student:${studentB.email}`);

  // ── Billing seed (Alpha only) ─────────────────────────────────────────────
  const planBasic = await prisma.tuitionPlan.upsert({
    where:  { id: "plan-alpha-basic" },
    update: {},
    create: {
      id:        "plan-alpha-basic",
      academyId: academyA.id,
      name:      "기초 월정액",
      amount:    150_000,
      currency:  "KRW",
      billingDay: 1,
      graceDays:  3,
      lateFee:    0,
      isActive:   true,
    },
  });

  const planAdv = await prisma.tuitionPlan.upsert({
    where:  { id: "plan-alpha-adv" },
    update: {},
    create: {
      id:        "plan-alpha-adv",
      academyId: academyA.id,
      name:      "심화 월정액",
      amount:    250_000,
      currency:  "KRW",
      billingDay: 1,
      graceDays:  5,
      lateFee:    5_000,
      isActive:   true,
    },
  });
  console.log(`✅  Tuition plans: "${planBasic.name}" ${planBasic.amount}원, "${planAdv.name}" ${planAdv.amount}원`);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const nextBilling = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

  const sub = await prisma.studentSubscription.upsert({
    where:  { id: "sub-alpha-student-basic" },
    update: {},
    create: {
      id:             "sub-alpha-student-basic",
      academyId:      academyA.id,
      studentUserId:  studentA.id,
      planId:         planBasic.id,
      status:         "ACTIVE",
      startDate:      today,
      nextBillingDate: nextBilling,
    },
  });

  const orderId = `ord-seed-${sub.id}-${nextBilling.toISOString().slice(0, 7)}`;
  await prisma.invoice.upsert({
    where:  { orderId },
    update: {},
    create: {
      academyId:     academyA.id,
      subscriptionId: sub.id,
      studentUserId: studentA.id,
      planId:        planBasic.id,
      amount:        planBasic.amount,
      dueDate:       nextBilling,
      status:        "PENDING",
      orderId,
    },
  });
  console.log(`✅  Subscription ${sub.id} → ${studentA.email} on "${planBasic.name}"`);

  // ── Attendance domain seed ─────────────────────────────────────────────────

  // Class: Monday + Wednesday piano class
  const pianoClass = await prisma.class.upsert({
    where:  { id: "class-alpha-piano-001" },
    update: {},
    create: {
      id:            "class-alpha-piano-001",
      academyId:     academyA.id,
      name:          "초급 피아노반",
      teacherUserId: teacherA.id,
      status:        ClassStatus.ACTIVE,
      capacity:      10,
      startDate:     new Date("2026-02-01"),
    },
  });

  const violinClass = await prisma.class.upsert({
    where:  { id: "class-alpha-violin-001" },
    update: {},
    create: {
      id:            "class-alpha-violin-001",
      academyId:     academyA.id,
      name:          "중급 바이올린반",
      teacherUserId: teacherA.id,
      status:        ClassStatus.ACTIVE,
      capacity:      8,
      startDate:     new Date("2026-02-01"),
    },
  });

  console.log(`✅  Classes: "${pianoClass.name}", "${violinClass.name}"`);

  // Schedules: Piano → Mon(1)+Wed(3) 15:00 60min; Violin → Tue(2)+Thu(4) 16:00 90min
  await prisma.classSchedule.upsert({
    where:  { id: "sched-piano-001" },
    update: {},
    create: {
      id:         "sched-piano-001",
      academyId:  academyA.id,
      classId:    pianoClass.id,
      daysOfWeek: [1, 3],
      startTime:  "15:00",
      durationMin: 60,
      timezone:   "Asia/Seoul",
    },
  });

  await prisma.classSchedule.upsert({
    where:  { id: "sched-violin-001" },
    update: {},
    create: {
      id:         "sched-violin-001",
      academyId:  academyA.id,
      classId:    violinClass.id,
      daysOfWeek: [2, 4],
      startTime:  "16:00",
      durationMin: 90,
      timezone:   "Asia/Seoul",
    },
  });

  // Enrollments
  await prisma.classEnrollment.upsert({
    where:  { academyId_classId_studentUserId: { academyId: academyA.id, classId: pianoClass.id, studentUserId: studentA.id } },
    update: {},
    create: {
      academyId:     academyA.id,
      classId:       pianoClass.id,
      studentUserId: studentA.id,
      status:        EnrollmentStatus.ACTIVE,
    },
  });

  await prisma.classEnrollment.upsert({
    where:  { academyId_classId_studentUserId: { academyId: academyA.id, classId: pianoClass.id, studentUserId: studentA2.id } },
    update: {},
    create: {
      academyId:     academyA.id,
      classId:       pianoClass.id,
      studentUserId: studentA2.id,
      status:        EnrollmentStatus.ACTIVE,
    },
  });

  await prisma.classEnrollment.upsert({
    where:  { academyId_classId_studentUserId: { academyId: academyA.id, classId: violinClass.id, studentUserId: studentA.id } },
    update: {},
    create: {
      academyId:     academyA.id,
      classId:       violinClass.id,
      studentUserId: studentA.id,
      status:        EnrollmentStatus.ACTIVE,
    },
  });
  console.log(`✅  Enrollments created`);

  // Generate ClassSessions: last 2 weeks + next 8 weeks (piano class, Mon+Wed)
  // We'll create a handful of past sessions manually for demo purposes
  // KST offset = UTC+9, so 15:00 KST = 06:00 UTC
  const kstOffsetMs = 9 * 60 * 60 * 1000;

  // Find recent Mondays and Wednesdays relative to today
  const seedSessions: Array<{ classId: string; localDate: string; startsAt: Date; endsAt: Date; status: SessionStatus }> = [];

  // Seed 4 weeks back + 8 weeks forward for pianoClass
  for (let weekOffset = -4; weekOffset <= 8; weekOffset++) {
    for (const dow of [1, 3]) { // Mon, Wed
      // Find the date of this weekday in the target week
      const base = new Date(today);
      // Start from Monday of current week
      const currentDow = base.getUTCDay(); // 0=Sun
      const daysToMonday = (currentDow === 0 ? -6 : 1 - currentDow);
      base.setUTCDate(base.getUTCDate() + daysToMonday + weekOffset * 7 + (dow - 1));
      // startsAt: that date at 06:00 UTC (= 15:00 KST)
      const startsAt = new Date(base);
      startsAt.setUTCHours(6, 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      const localDate = toKSTDate(startsAt);
      const isPast = startsAt < today;
      const status: SessionStatus = isPast ? SessionStatus.COMPLETED : SessionStatus.SCHEDULED;
      seedSessions.push({ classId: pianoClass.id, localDate, startsAt, endsAt, status });
    }
  }

  // Seed 4 weeks back + 8 weeks forward for violinClass (Tue, Thu)
  for (let weekOffset = -4; weekOffset <= 8; weekOffset++) {
    for (const dow of [2, 4]) { // Tue, Thu
      const base = new Date(today);
      const currentDow = base.getUTCDay();
      const daysToMonday = (currentDow === 0 ? -6 : 1 - currentDow);
      base.setUTCDate(base.getUTCDate() + daysToMonday + weekOffset * 7 + (dow - 1));
      const startsAt = new Date(base);
      startsAt.setUTCHours(7, 0, 0, 0); // 16:00 KST
      const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
      const localDate = toKSTDate(startsAt);
      const isPast = startsAt < today;
      const status: SessionStatus = isPast ? SessionStatus.COMPLETED : SessionStatus.SCHEDULED;
      seedSessions.push({ classId: violinClass.id, localDate, startsAt, endsAt, status });
    }
  }

  let sessionCount = 0;
  const createdSessions: Record<string, string> = {}; // classId+startsAt.toISOString() → sessionId

  for (const s of seedSessions) {
    const key = `${s.classId}_${s.startsAt.toISOString()}`;
    const existing = await prisma.classSession.findUnique({
      where: { classId_startsAt: { classId: s.classId, startsAt: s.startsAt } },
    });
    if (!existing) {
      const created = await prisma.classSession.create({
        data: {
          academyId: academyA.id,
          classId:   s.classId,
          startsAt:  s.startsAt,
          endsAt:    s.endsAt,
          localDate: s.localDate,
          status:    s.status,
        },
      });
      createdSessions[key] = created.id;
      sessionCount++;
    } else {
      createdSessions[key] = existing.id;
    }
  }
  console.log(`✅  ClassSessions: ${sessionCount} created (${seedSessions.length} total planned)`);

  // Seed Attendance for past sessions of pianoClass (studentA and studentA2)
  const pastPianoSessions = await prisma.classSession.findMany({
    where: {
      classId:   pianoClass.id,
      academyId: academyA.id,
      status:    SessionStatus.COMPLETED,
    },
    orderBy: { startsAt: "asc" },
    take: 8,
  });

  const attendanceStatuses: AttendanceStatus[] = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.LATE,
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.EXCUSED,
  ];

  let attCount = 0;
  for (let i = 0; i < pastPianoSessions.length; i++) {
    const session = pastPianoSessions[i];
    for (const student of [studentA, studentA2]) {
      const attStatus = attendanceStatuses[i % attendanceStatuses.length];
      await prisma.attendance.upsert({
        where: {
          academyId_sessionId_studentUserId: {
            academyId:     academyA.id,
            sessionId:     session.id,
            studentUserId: student.id,
          },
        },
        update: {},
        create: {
          academyId:     academyA.id,
          sessionId:     session.id,
          classId:       pianoClass.id,
          studentUserId: student.id,
          status:        attStatus,
          markedAt:      session.startsAt,
          markedByUserId: teacherA.id,
        },
      });
      attCount++;
    }
  }
  console.log(`✅  Attendance records: ${attCount} created`);

  console.log(`\n🎉  Seed complete!\n`);
  console.log("────────────────────────────────────────────────────────────");
  console.log(`SUPER_ADMIN      : ${superEmail}  /  ${superPw}`);
  console.log(`Alpha ADMIN      : admin@alpha.com  /  Admin1234!`);
  console.log(`Alpha TEACHER    : teacher@alpha.com  /  Teacher1234!`);
  console.log(`Alpha STUDENT    : student@alpha.com  /  Student1234!`);
  console.log(`Alpha STUDENT 2  : student2@alpha.com  /  Student1234!`);
  console.log(`Beta  ADMIN      : admin@beta.com  /  Admin1234!  [SUSPENDED]`);
  console.log(`Beta  STUDENT    : student@beta.com  /  Student1234!  [SUSPENDED]`);
  console.log("────────────────────────────────────────────────────────────");
  console.log(`Class : "${pianoClass.name}" (Mon+Wed 15:00, 60min)`);
  console.log(`Class : "${violinClass.name}" (Tue+Thu 16:00, 90min)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
