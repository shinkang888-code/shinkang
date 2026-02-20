/**
 * src/lib/services/notification.service.ts
 *
 * NotificationService:
 * - Persists a Notification row before attempting delivery
 * - Calls sendKakaoAlimTalk
 * - On failure: retries up to MAX_ATTEMPTS (3) with exponential back-off
 *   (back-off is implemented at the caller level; this method handles one attempt)
 * - Updates status / lastError / sentAt
 *
 * Public API:
 *   enqueue()      – create PENDING row, then attempt immediately
 *   processRetry() – re-attempt FAILED rows (called from a cron/route)
 */
import { prisma } from "@/lib/db/client";
import { sendKakaoAlimTalk } from "@/lib/kakao";
import type { NotificationChannel } from "@prisma/client";

const MAX_ATTEMPTS = 3;

export interface EnqueueParams {
  academyId:    string;
  recipientId?: string;
  phone:        string;
  channel?:     NotificationChannel;
  templateCode: string;
  params:       Record<string, string>;
}

export async function enqueueNotification(p: EnqueueParams) {
  // Persist first so we have an ID regardless of delivery outcome
  const notif = await prisma.notification.create({
    data: {
      academyId:    p.academyId,
      recipientId:  p.recipientId ?? null,
      channel:      p.channel ?? "KAKAO_ALIM",
      templateCode: p.templateCode,
      params:       p.params,
      phone:        p.phone,
      status:       "PENDING",
      attempts:     0,
    },
  });

  return attemptDelivery(notif.id);
}

/** Called immediately after creation or during retry sweep */
export async function attemptDelivery(notificationId: string) {
  const notif = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notif) return;
  if (notif.attempts >= MAX_ATTEMPTS) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "FAILED" },
    });
    return;
  }

  // Increment attempt count & mark RETRYING (or PENDING for first attempt)
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      attempts: { increment: 1 },
      status:   notif.attempts > 0 ? "RETRYING" : "PENDING",
    },
  });

  const result = await sendKakaoAlimTalk({
    templateCode: notif.templateCode,
    phone:        notif.phone,
    variables:    notif.params as Record<string, string>,
  });

  if (result.success) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "SENT", sentAt: new Date(), lastError: null },
    });
  } else {
    const newAttempts = notif.attempts + 1;
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status:    newAttempts >= MAX_ATTEMPTS ? "FAILED" : "RETRYING",
        lastError: result.error ?? "Unknown error",
      },
    });
    console.error(
      `[Notification] id=${notificationId} attempt=${newAttempts} error=${result.error}`,
    );
  }

  return result;
}

/** Sweep PENDING + RETRYING notifications that haven't exceeded MAX_ATTEMPTS */
export async function processRetries() {
  const due = await prisma.notification.findMany({
    where: {
      status:   { in: ["PENDING", "RETRYING"] },
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  const results = await Promise.allSettled(
    due.map((n) => attemptDelivery(n.id)),
  );

  return {
    processed: due.length,
    settled:   results.length,
  };
}
