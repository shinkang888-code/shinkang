/**
 * src/lib/auth/audit.ts
 * Fire-and-forget audit log helper.
 */
import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

export async function audit(opts: {
  actorUserId?: string | null;
  academyId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metaJson?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: opts.actorUserId ?? undefined,
        academyId:   opts.academyId ?? undefined,
        action:      opts.action,
        targetType:  opts.targetType ?? undefined,
        targetId:    opts.targetId ?? undefined,
        metaJson:    opts.metaJson !== undefined
          ? (opts.metaJson as Prisma.InputJsonValue)
          : undefined,
        ip:          opts.ip ?? undefined,
      },
    });
  } catch {
    // Non-fatal; don't break the request
  }
}
