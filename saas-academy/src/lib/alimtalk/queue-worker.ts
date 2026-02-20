/**
 * src/lib/alimtalk/queue-worker.ts
 *
 * Queue worker: processes pending NotificationQueue rows.
 *
 * Designed to be called from a cron-style route handler
 * (POST /api/internal/notifications/process).
 *
 * Algorithm:
 *  1. Fetch up to `batchSize` PENDING rows where nextRetryAt <= now.
 *  2. Mark each row PROCESSING (atomic check to avoid double-processing).
 *  3. Call sendAlimtalk().
 *  4a. Success → status=SENT, providerMsgKey, processedAt.
 *  4b. Failure → attempts++; if < maxAttempts: status=PENDING, nextRetryAt with
 *                exponential back-off; else status=FAILED.
 *  5. Return summary.
 */

import { prisma }        from "@/lib/db/client";
import { sendAlimtalk }  from "@/lib/alimtalk/client";
import { audit }         from "@/lib/auth/audit";

const DEFAULT_BATCH = 50;

// Exponential back-off delays in minutes: attempt 1→5m, 2→30m, 3→120m
const BACKOFF_MINUTES = [5, 30, 120];

export interface WorkerResult {
  processed: number;
  succeeded: number;
  failed:    number;
  skipped:   number;
}

export async function processNotificationQueue(
  batchSize = DEFAULT_BATCH,
): Promise<WorkerResult> {
  const now = new Date();

  // ── 1. Fetch due rows ──────────────────────────────────────────────────────
  const rows = await prisma.notificationQueue.findMany({
    where: {
      status:      { in: ["PENDING"] },
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: "asc" },
    take:    batchSize,
  });

  let succeeded = 0;
  let failed    = 0;
  let skipped   = 0;

  for (const row of rows) {
    // ── 2. Claim row (optimistic lock via status update) ───────────────────
    const claimed = await prisma.notificationQueue.updateMany({
      where:  { id: row.id, status: "PENDING" },
      data:   { status: "PROCESSING" },
    });

    if (claimed.count === 0) {
      skipped++;
      continue; // Another worker beat us to it
    }

    // ── 3. Send ────────────────────────────────────────────────────────────
    const result = await sendAlimtalk({
      senderKey:    row.senderKey,
      templateCode: row.templateCode,
      phone:        row.recipientPhone,
      variables:    row.templateVarsJson as Record<string, string>,
    });

    const newAttempts = row.attempts + 1;

    if (result.success) {
      // ── 4a. Success ──────────────────────────────────────────────────────
      await prisma.notificationQueue.update({
        where: { id: row.id },
        data:  {
          status:         "SENT",
          attempts:       newAttempts,
          processedAt:    now,
          providerMsgKey: result.msgKey ?? null,
          errorCode:      null,
          errorMessage:   null,
        },
      });

      await audit({
        academyId:  row.academyId,
        action:     "alimtalk.sent",
        targetType: "NotificationQueue",
        targetId:   row.id,
        metaJson:   {
          phone:    row.recipientPhone,
          msgKey:   result.msgKey,
          attempts: newAttempts,
        },
      });

      succeeded++;
    } else {
      // ── 4b. Failure ──────────────────────────────────────────────────────
      const exhausted = newAttempts >= row.maxAttempts;
      const backoffMs = (BACKOFF_MINUTES[newAttempts - 1] ?? 120) * 60_000;
      const nextRetry = exhausted
        ? null
        : new Date(now.getTime() + backoffMs);

      await prisma.notificationQueue.update({
        where: { id: row.id },
        data:  {
          status:       exhausted ? "FAILED" : "PENDING",
          attempts:     newAttempts,
          nextRetryAt:  nextRetry,
          errorCode:    result.errorCode ?? null,
          errorMessage: result.errorMessage ?? null,
        },
      });

      if (exhausted) {
        await audit({
          academyId:  row.academyId,
          action:     "alimtalk.failed",
          targetType: "NotificationQueue",
          targetId:   row.id,
          metaJson:   {
            phone:       row.recipientPhone,
            error:       result.errorMessage,
            attempts:    newAttempts,
          },
        });
        failed++;
      }
    }
  }

  return {
    processed: rows.length,
    succeeded,
    failed,
    skipped,
  };
}
