/**
 * SaaS Prisma Client singleton
 * Uses dedicated saas_academy database, completely isolated from piano_academy
 */
import { PrismaClient } from "@prisma/saas-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForSaasPrisma = global as unknown as { saasPrisma: PrismaClient };

function createSaasPrisma() {
  const pool = new Pool({ connectionString: process.env.SAAS_DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const saasPrisma: PrismaClient =
  globalForSaasPrisma.saasPrisma ?? createSaasPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForSaasPrisma.saasPrisma = saasPrisma;
}
