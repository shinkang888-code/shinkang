/**
 * src/lib/db/tenant.ts
 *
 * Prisma Client Extension — tenant scoping.
 *
 * Usage in Route Handlers:
 *   const db = scopedPrisma({ academyId: "...", role: "ADMIN" });
 *   // All queries on scoped models are automatically filtered by academyId.
 *   // SUPER_ADMIN gets unscoped prisma (pass role = "SUPER_ADMIN").
 *
 * Models that have an `academyId` field are automatically scoped:
 *   User, Session, Invite, AuditLog, Notification
 *
 * The extension uses `$extends` with a `query` component to inject
 * `WHERE academyId = ?` on findMany/findFirst/findUnique and validates
 * academyId on create/update.
 */
import { prisma as basePrisma } from "./client";

/** The models that carry an academyId FK and must be scoped */
const SCOPED_MODELS = new Set([
  "user",
  "session",
  "invite",
  "auditLog",
  "notification",
] as const);

type ScopedModel = typeof SCOPED_MODELS extends Set<infer T> ? T : never;

export interface TenantContext {
  academyId: string | null;
  role:      string;
}

/**
 * Returns a scoped Prisma client.
 * SUPER_ADMIN (role === "SUPER_ADMIN") gets the unscoped base client.
 */
export function scopedPrisma(ctx: TenantContext) {
  if (ctx.role === "SUPER_ADMIN" || !ctx.academyId) {
    return basePrisma; // full access
  }

  const { academyId } = ctx;

  return basePrisma.$extends({
    query: {
      // Inject academyId filter on every read
      $allModels: {
        async findMany({ model, operation, args, query }: {
          model: string; operation: string;
          args: Record<string, unknown>; query: (a: unknown) => Promise<unknown>;
        }) {
          if (SCOPED_MODELS.has(model.toLowerCase() as ScopedModel)) {
            args.where = { ...(args.where as object ?? {}), academyId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }: {
          model: string;
          args: Record<string, unknown>; query: (a: unknown) => Promise<unknown>;
        }) {
          if (SCOPED_MODELS.has(model.toLowerCase() as ScopedModel)) {
            args.where = { ...(args.where as object ?? {}), academyId };
          }
          return query(args);
        },
        async findUnique({ model, args, query }: {
          model: string;
          args: Record<string, unknown>; query: (a: unknown) => Promise<unknown>;
        }) {
          if (SCOPED_MODELS.has(model.toLowerCase() as ScopedModel)) {
            // Rewrite as findFirst with academyId guard to prevent cross-tenant lookup
            const where = { ...(args.where as object ?? {}), academyId };
            const result = await (basePrisma as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[model.toLowerCase()]
              .findFirst({ where });
            return result;
          }
          return query(args);
        },
        async create({ model, args, query }: {
          model: string;
          args: { data: Record<string, unknown> }; query: (a: unknown) => Promise<unknown>;
        }) {
          if (SCOPED_MODELS.has(model.toLowerCase() as ScopedModel)) {
            // Enforce academyId on create — prevent cross-tenant writes
            if (args.data.academyId && args.data.academyId !== academyId) {
              throw new Error(
                `Tenant violation: cannot create ${model} for academy ${String(args.data.academyId)}`,
              );
            }
            args.data.academyId = academyId;
          }
          return query(args);
        },
        async update({ model, args, query }: {
          model: string;
          args: Record<string, unknown>; query: (a: unknown) => Promise<unknown>;
        }) {
          if (SCOPED_MODELS.has(model.toLowerCase() as ScopedModel)) {
            args.where = { ...(args.where as object ?? {}), academyId };
          }
          return query(args);
        },
        async delete({ model, args, query }: {
          model: string;
          args: Record<string, unknown>; query: (a: unknown) => Promise<unknown>;
        }) {
          if (SCOPED_MODELS.has(model.toLowerCase() as ScopedModel)) {
            args.where = { ...(args.where as object ?? {}), academyId };
          }
          return query(args);
        },
        async deleteMany({ model, args, query }: {
          model: string;
          args: Record<string, unknown>; query: (a: unknown) => Promise<unknown>;
        }) {
          if (SCOPED_MODELS.has(model.toLowerCase() as ScopedModel)) {
            args.where = { ...(args.where as object ?? {}), academyId };
          }
          return query(args);
        },
      },
    },
  });
}
