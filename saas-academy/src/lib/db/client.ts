/**
 * src/lib/db/client.ts
 * Single Prisma client instance (no tenant scoping here – see tenant-extension.ts).
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { _saas_prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma._saas_prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma._saas_prisma = prisma;
}
