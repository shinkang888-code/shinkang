/**
 * src/lib/toss/webhooks.ts
 *
 * Toss webhook verification utilities.
 *
 * Toss signs webhook payloads with HMAC-SHA256 using the secret key.
 * Header: Toss-Signature: <base64(HMAC-SHA256(rawBody, secretKey))>
 *
 * Docs: https://docs.tosspayments.com/reference/using-api/webhooks
 */

import crypto from "crypto";

/** Known Toss webhook event types (non-exhaustive). */
export type TossWebhookEventType =
  | "PAYMENT_STATUS_CHANGED"
  | "BILLING_STATUS_CHANGED"
  | "DEPOSIT_CALLBACK";

export interface TossWebhookPayload {
  eventType: TossWebhookEventType;
  createdAt: string;
  data: Record<string, unknown>;
}

/**
 * Verify the Toss webhook signature.
 *
 * @param rawBody   – raw request body as Buffer or string
 * @param signature – value of the Toss-Signature header
 * @returns true if signature is valid
 */
export function verifyTossWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
): boolean {
  const secret = process.env.TOSS_PAYMENTS_SECRET_KEY;
  if (!secret) {
    console.error("[toss/webhook] TOSS_PAYMENTS_SECRET_KEY not set");
    return false;
  }

  try {
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("base64");

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expected, "base64"),
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}

/**
 * Parse and validate a Toss webhook body.
 * Returns null if parsing fails.
 */
export function parseTossWebhookBody(
  rawBody: string,
): TossWebhookPayload | null {
  try {
    const parsed = JSON.parse(rawBody) as TossWebhookPayload;
    if (!parsed.eventType || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}
