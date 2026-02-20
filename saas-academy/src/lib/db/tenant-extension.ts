/**
 * src/lib/db/tenant-extension.ts
 *
 * Prisma Client Extension that automatically injects academyId scoping
 * into every query on tenant-owned models.
 *
 * Usage:
 *   import { scopedPrisma } from "@/lib/db/tenant-extension";
 *   const db = scopedPrisma(ctx);          // ctx.academyId | ctx.role
 *   await db.user.findMany();              // auto-adds WHERE academyId = ctx.academyId
 *
 * SUPER_ADMIN passes ctx = { academyId: null, role: "SUPER_ADMIN" }
 * → scoping is bypassed.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "./client";

// Models that carry an academyId column and must be scoped.
const TENANT_MODELS = new Set([
  "user",
  "session",
  "invite",
  "auditlog",
  "class",
  "classschedule",
  "classenrollment",
  "classsession",
  "attendance",
  "attendancehistory",
  "tuitionplan",
  "studentsubscription",
  "paymentmethod",
  "invoice",
  "paymentattempt",
  "notification",
] as const);

export interface TenantContext {
  academyId: string | null;
  role: string;
}

export function scopedPrisma(ctx: TenantContext) {
  const isSuperAdmin = ctx.role === "SUPER_ADMIN";

  return prisma.$extends({
    name: "tenantScope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Skip scoping for SUPER_ADMIN or models without academyId
          if (isSuperAdmin || !model || !TENANT_MODELS.has(model.toLowerCase() as any)) {
            return query(args);
          }

          if (!ctx.academyId) {
            throw new Error(
              `[TenantScope] academyId is required for ${model}.${operation} (role: ${ctx.role})`,
            );
          }

          const academyId = ctx.academyId;

          // ── Write operations: inject academyId into data ──────────────────
          if (operation === "create") {
            (args as any).data = { ...(args as any).data, academyId };
          }
          if (operation === "createMany" && (args as any).data) {
            const rows = Array.isArray((args as any).data)
              ? (args as any).data
              : [(args as any).data];
            (args as any).data = rows.map((r: Record<string, unknown>) => ({
              ...r,
              academyId,
            }));
          }

          // ── Read/Update/Delete operations: inject WHERE clause ────────────
          if (
            [
              "findUnique", "findUniqueOrThrow",
              "findFirst", "findFirstOrThrow",
              "findMany", "count", "aggregate", "groupBy",
              "update", "updateMany",
              "delete", "deleteMany",
              "upsert",
            ].includes(operation)
          ) {
            (args as any).where = {
              ...(args as any).where,
              academyId,
            };
          }

          return query(args);
        },
      },
    },
  });
}

/** Unscoped client for SUPER_ADMIN or internal system operations. */
export const unscopedPrisma = prisma;
