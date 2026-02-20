/**
 * src/lib/services/billing.service.ts
 *
 * Core billing logic for the daily scheduler.
 */

import { prisma } from "@/lib/db/client";
import { chargeWithBillingKey } from "@/lib/toss/charge";
import { TossError } from "@/lib/toss/tossClient";
import { addMonths, setDate, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const MAX_ATTEMPTS = 3;
const KST_TZ       = "Asia/Seoul";

export interface BillingRunResult {
  processed: number;
  succeeded: number;
  failed:    number;
  skipped:   number;
  errors:    string[];
}

/** Returns "today" in KST as a UTC Date at midnight. */
export function todayKST(): Date {
  const nowKST = toZonedTime(new Date(), KST_TZ);
  const midKST = startOfDay(nowKST);
  return fromZonedTime(midKST, KST_TZ);
}

export async function runDailyBilling(): Promise<BillingRunResult> {
  const result: BillingRunResult = {
    processed: 0,
    succeeded: 0,
    failed:    0,
    skipped:   0,
    errors:    [],
  };

  const today = todayKST();

  // Load invoices with plan and attempts (no direct student relation on Invoice)
  const invoices = await prisma.invoice.findMany({
    where: {
      status:  "PENDING",
      dueDate: { lte: today },
    },
    include: {
      plan:         true,
      attempts:     { orderBy: { attemptNo: "asc" } },
      subscription: true,
    },
  });

  // Pre-fetch students in bulk
  const studentIds = [...new Set(invoices.map((i) => i.studentUserId))];
  const studentsRaw = await prisma.user.findMany({
    where:  { id: { in: studentIds } },
    select: { id: true, name: true, email: true },
  });
  const studentMap = Object.fromEntries(studentsRaw.map((s) => [s.id, s]));

  for (const invoice of invoices) {
    result.processed++;

    const student = studentMap[invoice.studentUserId];

    if (invoice.attempts.length >= MAX_ATTEMPTS) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data:  { status: "FAILED" },
      });
      result.failed++;
      continue;
    }

    const pm = await prisma.paymentMethod.findFirst({
      where: {
        studentUserId: invoice.studentUserId,
        academyId:     invoice.academyId,
        status:        "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!pm) {
      result.skipped++;
      result.errors.push(
        `Invoice ${invoice.id}: no active payment method for student ${invoice.studentUserId}`,
      );
      continue;
    }

    const attemptNo = invoice.attempts.length + 1;

    const attempt = await prisma.paymentAttempt.create({
      data: {
        academyId:   invoice.academyId,
        invoiceId:   invoice.id,
        attemptNo,
        requestedAt: new Date(),
        status:      "REQUESTED",
      },
    });

    try {
      const charge = await chargeWithBillingKey({
        billingKey:    pm.billingKey,
        customerKey:   pm.customerKey,
        amount:        invoice.amount,
        orderId:       invoice.orderId,
        orderName:     `${invoice.plan?.name ?? "수강료"} (${invoice.dueDate.toISOString().slice(0, 7)})`,
        customerName:  student?.name ?? undefined,
        customerEmail: student?.email ?? undefined,
      });

      await prisma.$transaction(async (tx) => {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status:                "SUCCESS",
            providerTransactionId: charge.paymentKey,
          },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status:             "PAID",
            paidAt:             new Date(),
            providerPaymentKey: charge.paymentKey,
          },
        });

        if (invoice.subscriptionId && invoice.plan) {
          const plan    = invoice.plan;
          const nextNbd = setDate(addMonths(invoice.dueDate, 1), plan.billingDay);
          const nextOid = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

          await tx.studentSubscription.update({
            where: { id: invoice.subscriptionId },
            data:  { nextBillingDate: nextNbd },
          });
          await tx.invoice.create({
            data: {
              academyId:      invoice.academyId,
              subscriptionId: invoice.subscriptionId,
              studentUserId:  invoice.studentUserId,
              planId:         invoice.planId,
              amount:         plan.amount,
              dueDate:        nextNbd,
              orderId:        nextOid,
              status:         "PENDING",
            },
          });
        }
      });

      result.succeeded++;
    } catch (e) {
      const isKnown      = e instanceof TossError;
      const errorCode    = isKnown ? e.code    : "UNKNOWN";
      const errorMessage = isKnown ? e.message : String(e);

      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data:  { status: "FAILED", errorCode, errorMessage },
      });

      if (attemptNo >= MAX_ATTEMPTS) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data:  { status: "FAILED" },
        });
      }

      result.failed++;
      result.errors.push(`Invoice ${invoice.id} attempt ${attemptNo}: ${errorMessage}`);
    }
  }

  return result;
}
