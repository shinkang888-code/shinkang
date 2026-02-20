/**
 * SaaS Database Seed Script
 * Creates:
 * - 1 SUPER_ADMIN (no academy)
 * - 2 Academies (alpha-piano, beta-music)
 * - 1 ADMIN per academy
 * - 1 TEACHER per academy
 * - 2 STUDENTs per academy
 * - 1 SUSPENDED academy with 1 user (to test login block)
 */
import { PrismaClient } from "@prisma/saas-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString:
    process.env.SAAS_DATABASE_URL ??
    "postgresql://postgres:postgres123@localhost:5432/saas_academy",
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function main() {
  console.log("🌱 Seeding SaaS database...\n");

  // ─── SUPER_ADMIN ────────────────────────────────────────────────
  const superAdmin = await prisma.saasUser.upsert({
    where: { email: "super@saas.com" },
    update: {},
    create: {
      email: "super@saas.com",
      name: "슈퍼 어드민",
      passwordHash: await hash("Super1234!"),
      role: "SUPER_ADMIN",
      academyId: null,
    },
  });
  console.log(`✅ SUPER_ADMIN: ${superAdmin.email}`);

  // ─── Academy A: alpha-piano ──────────────────────────────────────
  const alphaAcademy = await prisma.academy.upsert({
    where: { code: "alpha-piano" },
    update: {},
    create: {
      name: "알파 피아노 학원",
      code: "alpha-piano",
      status: "ACTIVE",
    },
  });
  console.log(`✅ Academy: ${alphaAcademy.name} (${alphaAcademy.code})`);

  const alphaAdmin = await prisma.saasUser.upsert({
    where: { email: "admin@alpha.com" },
    update: {},
    create: {
      email: "admin@alpha.com",
      name: "알파 원장",
      passwordHash: await hash("Admin1234!"),
      role: "ADMIN",
      academyId: alphaAcademy.id,
    },
  });
  console.log(`  👤 ADMIN: ${alphaAdmin.email}`);

  const alphaTeacher = await prisma.saasUser.upsert({
    where: { email: "teacher@alpha.com" },
    update: {},
    create: {
      email: "teacher@alpha.com",
      name: "알파 선생",
      passwordHash: await hash("Teacher1234!"),
      role: "TEACHER",
      academyId: alphaAcademy.id,
    },
  });
  console.log(`  👤 TEACHER: ${alphaTeacher.email}`);

  for (let i = 1; i <= 2; i++) {
    const s = await prisma.saasUser.upsert({
      where: { email: `student${i}@alpha.com` },
      update: {},
      create: {
        email: `student${i}@alpha.com`,
        name: `알파 학생${i}`,
        passwordHash: await hash("Student1234!"),
        role: "STUDENT",
        academyId: alphaAcademy.id,
      },
    });
    console.log(`  👤 STUDENT: ${s.email}`);
  }

  // ─── Academy B: beta-music ───────────────────────────────────────
  const betaAcademy = await prisma.academy.upsert({
    where: { code: "beta-music" },
    update: {},
    create: {
      name: "베타 음악 학원",
      code: "beta-music",
      status: "ACTIVE",
    },
  });
  console.log(`\n✅ Academy: ${betaAcademy.name} (${betaAcademy.code})`);

  const betaAdmin = await prisma.saasUser.upsert({
    where: { email: "admin@beta.com" },
    update: {},
    create: {
      email: "admin@beta.com",
      name: "베타 원장",
      passwordHash: await hash("Admin1234!"),
      role: "ADMIN",
      academyId: betaAcademy.id,
    },
  });
  console.log(`  👤 ADMIN: ${betaAdmin.email}`);

  for (let i = 1; i <= 2; i++) {
    const s = await prisma.saasUser.upsert({
      where: { email: `student${i}@beta.com` },
      update: {},
      create: {
        email: `student${i}@beta.com`,
        name: `베타 학생${i}`,
        passwordHash: await hash("Student1234!"),
        role: "STUDENT",
        academyId: betaAcademy.id,
      },
    });
    console.log(`  👤 STUDENT: ${s.email}`);
  }

  // ─── Suspended Academy ───────────────────────────────────────────
  const suspendedAcademy = await prisma.academy.upsert({
    where: { code: "suspended-test" },
    update: {},
    create: {
      name: "정지된 학원 (테스트)",
      code: "suspended-test",
      status: "SUSPENDED",
    },
  });
  console.log(`\n⏸  Academy (SUSPENDED): ${suspendedAcademy.name}`);

  await prisma.saasUser.upsert({
    where: { email: "student@suspended.com" },
    update: {},
    create: {
      email: "student@suspended.com",
      name: "정지된 원생",
      passwordHash: await hash("Student1234!"),
      role: "STUDENT",
      academyId: suspendedAcademy.id,
    },
  });
  console.log(`  👤 STUDENT in SUSPENDED academy: student@suspended.com`);

  // ─── Summary ─────────────────────────────────────────────────────
  console.log("\n🎉 SaaS Seed Complete!");
  console.log("═══════════════════════════════════════════");
  console.log("🔐 SUPER_ADMIN:  super@saas.com       / Super1234!");
  console.log("─────────────────────────────────────────");
  console.log("🏫 알파 피아노 (alpha-piano)");
  console.log("   ADMIN:    admin@alpha.com      / Admin1234!");
  console.log("   TEACHER:  teacher@alpha.com    / Teacher1234!");
  console.log("   STUDENT:  student1@alpha.com   / Student1234!");
  console.log("─────────────────────────────────────────");
  console.log("🏫 베타 음악 (beta-music)");
  console.log("   ADMIN:    admin@beta.com       / Admin1234!");
  console.log("   STUDENT:  student1@beta.com    / Student1234!");
  console.log("─────────────────────────────────────────");
  console.log("⏸  정지된 학원 (suspended-test)");
  console.log("   STUDENT:  student@suspended.com / Student1234! ← login blocked");
  console.log("═══════════════════════════════════════════");
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
