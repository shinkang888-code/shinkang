/**
 * src/lib/toss/billing.ts
 *
 * Billing key management helpers.
 *
 * Flow:
 *  1. Frontend calls Toss UI (TossPayments.requestBillingAuth) with customerKey.
 *  2. Toss redirects back with authKey in the query string.
 *  3. Server calls issueBillingKey(authKey, customerKey) to exchange for a billingKey.
 *  4. billingKey is stored in PaymentMethod table.
 *
 * Docs: https://docs.tosspayments.com/guides/v2/billing
 */

import { tossRequest } from "./tossClient";

export interface BillingAuthParams {
  /** Must be unique per customer – typically userId */
  customerKey: string;
  /** URL to redirect after Toss billing auth */
  successUrl: string;
  failUrl: string;
}

/** Not a server call – returns params for the frontend Toss JS SDK */
export function createBillingAuthParams(p: BillingAuthParams): BillingAuthParams {
  return p;
}

// ─── Issue Billing Key ────────────────────────────────────────────────────────

export interface IssueBillingKeyResponse {
  billingKey: string;
  cardCompany: string;
  cardNumber: string; // masked, e.g. "43XX-XXXX-XXXX-3456"
  customerKey: string;
  authenticatedAt: string;
}

/**
 * Exchange the authKey (from Toss redirect) for a persistent billingKey.
 * POST /v1/billing/authorizations/{authKey}
 */
export async function issueBillingKey(
  authKey: string,
  customerKey: string,
): Promise<IssueBillingKeyResponse> {
  return tossRequest<IssueBillingKeyResponse>(
    "POST",
    `/v1/billing/authorizations/${encodeURIComponent(authKey)}`,
    { customerKey },
  );
}

// ─── Delete (revoke) Billing Key ──────────────────────────────────────────────

export interface DeleteBillingKeyResponse {
  result: "SUCCESS";
}

/**
 * Revoke a billingKey so it can no longer be charged.
 * DELETE /v1/billing/authorizations/{billingKey}
 */
export async function revokeBillingKey(
  billingKey: string,
): Promise<DeleteBillingKeyResponse> {
  return tossRequest<DeleteBillingKeyResponse>(
    "DELETE",
    `/v1/billing/authorizations/${encodeURIComponent(billingKey)}`,
  );
}
