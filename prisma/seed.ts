import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function getNextWeekday(dayOfWeek: number): Date {
  const today = new Date();
  const todayDay = today.getDay();
  let diff = dayOfWeek - todayDay;
  if (diff <= 0) diff += 7;
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

async function main() {
  console.log("🌱 Seeding database...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@piano-academy.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin1234!";
  const studioName = process.env.SEED_STUDIO_NAME ?? "행복 피아노 학원";

  const hashedPw = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "원장 선생님",
      password: hashedPw,
      role: "ADMIN",
      phone: "010-1234-5678",
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  const studio = await prisma.studio.upsert({
    where: { id: "studio-seed-001" },
    update: {},
    create: {
      id: "studio-seed-001",
      name: studioName,
      address: "서울시 강남구 테헤란로 123",
      phone: "02-1234-5678",
      adminId: admin.id,
    },
  });
  console.log(`✅ Studio: ${studio.name}`);

  const studentData = [
    { name: "김민수", email: "student1@test.com", grade: "초등 4학년", parentName: "김부모", parentPhone: "010-9876-0001" },
    { name: "이지은", email: "student2@test.com", grade: "중등 1학년", parentName: "이부모", parentPhone: "010-9876-0002" },
    { name: "박준혁", email: "student3@test.com", grade: "고등 2학년", parentName: undefined, parentPhone: undefined },
  ];

  const studentPw = await bcrypt.hash("Student1234!", 12);
  const studentIds: string[] = [];

  for (const sd of studentData) {
    const user = await prisma.user.upsert({
      where: { email: sd.email },
      update: {},
      create: {
        email: sd.email,
        name: sd.name,
        password: studentPw,
        role: "STUDENT",
      },
    });

    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        studioId: studio.id,
        grade: sd.grade,
        parentName: sd.parentName,
        parentPhone: sd.parentPhone,
      },
    });
    studentIds.push(student.id);

    const now = new Date();
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 25);

    await prisma.payment.upsert({
      where: { id: `pay-${student.id}-${billingMonth}` },
      update: {},
      create: {
        id: `pay-${student.id}-${billingMonth}`,
        studentId: student.id,
        amount: 150000,
        billingMonth,
        dueDate,
        status: sd.name === "김민수" ? "PAID" : "PENDING",
        paidAt: sd.name === "김민수" ? new Date() : null,
        method: sd.name === "김민수" ? "BANK_TRANSFER" : null,
      },
    });

    console.log(`✅ Student: ${sd.name} (${sd.email})`);
  }

  // 레슨 마스터 생성
  const lesson1 = await prisma.lesson.upsert({
    where: { id: "lesson-seed-001" },
    update: {},
    create: {
      id: "lesson-seed-001",
      studioId: studio.id,
      title: "피아노 기초 레슨",
      dayOfWeek: 2,
      startTime: "15:00",
      endTime: "16:00",
      color: "#4F46E5",
      isRecurring: true,
    },
  });

  const lesson2 = await prisma.lesson.upsert({
    where: { id: "lesson-seed-002" },
    update: {},
    create: {
      id: "lesson-seed-002",
      studioId: studio.id,
      title: "피아노 심화 레슨",
      dayOfWeek: 4,
      startTime: "16:00",
      endTime: "17:00",
      color: "#7C3AED",
      isRecurring: true,
    },
  });

  console.log(`✅ Lessons created`);

  // 이번 주 + 다음 주 레슨 일정 생성
  const now = new Date();
  for (let weekOffset = 0; weekOffset < 3; weekOffset++) {
    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];

      // 화요일 레슨 (lesson1)
      const tue = getNextWeekday(2);
      tue.setDate(tue.getDate() + weekOffset * 7);
      const tueStart = new Date(tue);
      tueStart.setHours(15, 0, 0, 0);
      const tueEnd = new Date(tue);
      tueEnd.setHours(16, 0, 0, 0);

      await prisma.lessonSchedule.upsert({
        where: { id: `sched-${studentId}-tue-w${weekOffset}` },
        update: {},
        create: {
          id: `sched-${studentId}-tue-w${weekOffset}`,
          lessonId: lesson1.id,
          studentId,
          startAt: tueStart,
          endAt: tueEnd,
          status: weekOffset === 0 ? "SCHEDULED" : "SCHEDULED",
        },
      });

      // 목요일 레슨 (lesson2) - 2번째, 3번째 학생만
      if (i >= 1) {
        const thu = getNextWeekday(4);
        thu.setDate(thu.getDate() + weekOffset * 7);
        const thuStart = new Date(thu);
        thuStart.setHours(16, 0, 0, 0);
        const thuEnd = new Date(thu);
        thuEnd.setHours(17, 0, 0, 0);

        await prisma.lessonSchedule.upsert({
          where: { id: `sched-${studentId}-thu-w${weekOffset}` },
          update: {},
          create: {
            id: `sched-${studentId}-thu-w${weekOffset}`,
            lessonId: lesson2.id,
            studentId,
            startAt: thuStart,
            endAt: thuEnd,
            status: "SCHEDULED",
          },
        });
      }
    }
  }

  // 지난 주 완료된 레슨
  const lastWeekTue = getNextWeekday(2);
  lastWeekTue.setDate(lastWeekTue.getDate() - 7);
  lastWeekTue.setHours(15, 0, 0, 0);
  const lastWeekTueEnd = new Date(lastWeekTue);
  lastWeekTueEnd.setHours(16, 0, 0, 0);

  for (const studentId of studentIds) {
    await prisma.lessonSchedule.upsert({
      where: { id: `sched-${studentId}-last-tue` },
      update: {},
      create: {
        id: `sched-${studentId}-last-tue`,
        lessonId: lesson1.id,
        studentId,
        startAt: lastWeekTue,
        endAt: lastWeekTueEnd,
        status: "COMPLETED",
      },
    });
  }

  console.log(`✅ Lesson schedules created`);

  // ─── 선생님 계정 생성 ─────────────────────────────────────
  const teacherData = [
    { name: "박선생", email: "teacher1@test.com" },
    { name: "이선생", email: "teacher2@test.com" },
  ];
  const teacherPw = await bcrypt.hash("Teacher1234!", 12);

  for (const td of teacherData) {
    const tUser = await prisma.user.upsert({
      where: { email: td.email },
      update: {},
      create: {
        email: td.email,
        name: td.name,
        password: teacherPw,
        role: "TEACHER",
        phone: "010-5555-0001",
      },
    });

    await prisma.studioTeacher.upsert({
      where: { studioId_userId: { studioId: studio.id, userId: tUser.id } },
      update: {},
      create: {
        studioId: studio.id,
        userId: tUser.id,
        isActive: true,
      },
    });

    console.log(`✅ Teacher: ${td.name} (${td.email})`);
  }
  // ──────────────────────────────────────────────────────────

  // 연습 세션 샘플 (첫번째 학생)
  const student1 = await prisma.student.findFirst({
    where: { user: { email: "student1@test.com" } }
  });

  if (student1) {
    const practiceData = [
      { daysAgo: 1, minutes: 45, piece: "체르니 30번" },
      { daysAgo: 3, minutes: 30, piece: "소나티네" },
      { daysAgo: 5, minutes: 60, piece: "바이엘 후반부" },
      { daysAgo: 8, minutes: 25, piece: "체르니 30번" },
    ];

    for (const p of practiceData) {
      const start = new Date();
      start.setDate(start.getDate() - p.daysAgo);
      start.setHours(16, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(start.getMinutes() + p.minutes);

      await prisma.practiceSession.upsert({
        where: { id: `practice-${student1.id}-${p.daysAgo}` },
        update: {},
        create: {
          id: `practice-${student1.id}-${p.daysAgo}`,
          studentId: student1.id,
          startedAt: start,
          endedAt: end,
          durationMin: p.minutes,
          piece: p.piece,
        },
      });
    }
    console.log(`✅ Practice sessions created for 김민수`);
  }

  console.log("\n🎉 Seed completed!");
  console.log("─────────────────────────────");
  console.log(`관리자: ${adminEmail} / ${adminPassword}`);
  console.log(`선생님1: teacher1@test.com / Teacher1234!`);
  console.log(`선생님2: teacher2@test.com / Teacher1234!`);
  console.log(`원생1: student1@test.com / Student1234!`);
  console.log(`원생2: student2@test.com / Student1234!`);
  console.log(`원생3: student3@test.com / Student1234!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
