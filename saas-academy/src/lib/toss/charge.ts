/**
 * src/lib/toss/charge.ts
 *
 * Charge (automatic payment) using a stored billingKey.
 *
 * POST /v1/billing/{billingKey}
 * Uses Idempotency-Key header to prevent duplicate charges on retry.
 *
 * Docs: https://docs.tosspayments.com/guides/v2/billing
 */

import { tossRequest } from "./tossClient";

export interface ChargeParams {
  /** The billingKey issued by Toss for this customer. */
  billingKey: string;
  /** Must be unique per customer in Toss – typically userId. */
  customerKey: string;
  /** Amount in KRW (integer). */
  amount: number;
  /** Unique order ID on our side (stored in Invoice.orderId). */
  orderId: string;
  /** Human-readable order name, e.g. "3월 수강료". */
  orderName: string;
  /** Customer name (optional but recommended for dispute handling). */
  customerName?: string;
  /** Customer email (optional). */
  customerEmail?: string;
  /** Tax-free amount. Default 0. */
  taxFreeAmount?: number;
}

export interface ChargeResponse {
  paymentKey: string;
  orderId: string;
  orderName: string;
  status: "DONE" | "CANCELED" | "PARTIAL_CANCELED" | "ABORTED" | "EXPIRED";
  approvedAt: string;
  totalAmount: number;
  currency: string;
  card?: {
    company: string;
    number: string;
    installmentPlanMonths: number;
  };
}

/**
 * Charge a customer using their stored billingKey.
 *
 * @param params   – charge details
 * @param idempotencyKey – idempotency key (default: orderId)
 */
export async function chargeWithBillingKey(
  params: ChargeParams,
  idempotencyKey?: string,
): Promise<ChargeResponse> {
  const {
    billingKey,
    customerKey,
    amount,
    orderId,
    orderName,
    customerName,
    customerEmail,
    taxFreeAmount = 0,
  } = params;

  return tossRequest<ChargeResponse>(
    "POST",
    `/v1/billing/${encodeURIComponent(billingKey)}`,
    {
      customerKey,
      amount,
      orderId,
      orderName,
      customerName,
      customerEmail,
      taxFreeAmount,
    },
    idempotencyKey ?? orderId,  // use orderId as idempotency key by default
  );
}
