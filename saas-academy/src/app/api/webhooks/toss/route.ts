/**
 * POST /api/webhooks/toss
 *
 * Receives Toss Payments webhook events.
 * 1. Reads raw body (needed for signature verification).
 * 2. Verifies HMAC-SHA256 signature.
 * 3. Stores event in WebhookEvent table with PENDING status.
 * 4. Processes synchronously (small set of event types).
 *
 * Toss sends:
 *  - PAYMENT_STATUS_CHANGED  (for normal payments / refunds)
 *  - BILLING_STATUS_CHANGED  (for billing key changes)
 *  - DEPOSIT_CALLBACK        (for virtual account deposits)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  verifyTossWebhookSignature,
  parseTossWebhookBody,
} from "@/lib/toss/webhooks";

export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const signature = req.headers.get("toss-signature") ?? "";

  // 1. Verify signature
  if (!verifyTossWebhookSignature(rawBody, signature)) {
    console.warn("[webhook/toss] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse payload
  const payload = parseTossWebhookBody(rawBody);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 3. Persist to WebhookEvent (idempotency: ignore duplicate paymentKey)
  let event;
  try {
    event = await prisma.webhookEvent.create({
      data: {
        provider:         "TOSS_PAYMENTS",
        eventType:        payload.eventType,
        payloadJson:      rawBody,
        receivedAt:       new Date(),
        processingStatus: "PENDING",
      },
    });
  } catch (e) {
    // Likely duplicate – return 200 to prevent Toss retry storm
    console.warn("[webhook/toss] Could not persist event:", e);
    return NextResponse.json({ ok: true, note: "duplicate" });
  }

  // 4. Process event
  try {
    await processWebhookEvent(payload.eventType, payload.data);
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data:  { processedAt: new Date(), processingStatus: "DONE" },
    });
  } catch (err) {
    console.error("[webhook/toss] Processing error:", err);
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data:  { processingStatus: "ERROR" },
    });
    // Still return 200 so Toss doesn't retry indefinitely
  }

  return NextResponse.json({ ok: true });
}

async function processWebhookEvent(
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  switch (eventType) {
    case "PAYMENT_STATUS_CHANGED": {
      const paymentKey = data.paymentKey as string | undefined;
      const status     = data.status     as string | undefined;
      if (!paymentKey || !status) return;

      if (status === "CANCELED") {
        // Mark the invoice as CANCELED if found
        await prisma.invoice.updateMany({
          where: { providerPaymentKey: paymentKey },
          data:  { status: "CANCELED" },
        });
      }
      break;
    }

    case "BILLING_STATUS_CHANGED": {
      // billingKey was revoked externally (e.g. card expired)
      const billingKey = data.billingKey as string | undefined;
      if (!billingKey) return;

      await prisma.paymentMethod.updateMany({
        where: { billingKey },
        data:  { status: "REVOKED" },
      });
      break;
    }

    default:
      // Unknown event – logged and stored, no action needed
      break;
  }
}
