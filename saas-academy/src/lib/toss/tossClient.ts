/**
 * src/lib/toss/tossClient.ts
 *
 * Low-level HTTP client for Toss Payments API v2.
 * Uses Basic Auth: base64(secretKey + ":").
 *
 * Env vars required:
 *   TOSS_PAYMENTS_SECRET_KEY   – Toss secret key  (test_sk_xxx)
 *   TOSS_PAYMENTS_CLIENT_KEY   – Toss client key  (test_ck_xxx)  [for frontend use]
 *   TOSS_PAYMENTS_BASE_URL     – defaults to https://api.tosspayments.com
 */

const BASE_URL =
  process.env.TOSS_PAYMENTS_BASE_URL ?? "https://api.tosspayments.com";

function getAuthHeader(): string {
  const key = process.env.TOSS_PAYMENTS_SECRET_KEY;
  if (!key) throw new Error("TOSS_PAYMENTS_SECRET_KEY is not set");
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export interface TossApiError {
  code: string;
  message: string;
}

export class TossError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(`[Toss ${code}] ${message}`);
    this.name = "TossError";
  }
}

/**
 * Generic fetch wrapper for Toss API.
 * Throws TossError on non-2xx responses.
 */
export async function tossRequest<T = unknown>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: getAuthHeader(),
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // Disable Next.js fetch caching for payment calls
    cache: "no-store",
  });

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { message: text };
  }

  if (!response.ok) {
    const err = json as TossApiError;
    throw new TossError(
      err.code ?? "UNKNOWN",
      err.message ?? "Unknown Toss error",
      response.status,
    );
  }

  return json as T;
}
