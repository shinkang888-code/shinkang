/**
 * src/lib/services/audit.service.ts
 */
import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

export interface AuditParams {
  actorUserId?: string;
  academyId?:   string | null;
  action:       string;
  targetType?:  string;
  targetId?:    string;
  metaJson?:    Record<string, unknown>;
  ip?:          string;
}

export async function writeAuditLog(p: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: p.actorUserId ?? undefined,
        academyId:   p.academyId  ?? undefined,
        action:      p.action,
        targetType:  p.targetType ?? undefined,
        targetId:    p.targetId   ?? undefined,
        metaJson:    p.metaJson !== undefined
          ? (p.metaJson as Prisma.InputJsonValue)
          : undefined,
        ip:          p.ip ?? undefined,
      },
    });
  } catch (err) {
    console.error("[Audit] Failed to write log:", err);
  }
}
