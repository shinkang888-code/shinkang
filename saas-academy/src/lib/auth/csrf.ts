/**
 * src/lib/auth/csrf.ts
 *
 * CSRF protection for state-mutating API routes.
 *
 * Strategy:
 *   1. On login, a random 32-byte CSRF token is generated.
 *   2. It is stored in:
 *      - An httpOnly-false cookie (sa_csrf)  — readable by JS
 *      - The user's Session row in the DB    — for server-side validation
 *   3. Every mutating request (POST/PUT/PATCH/DELETE) must include the token
 *      in either the X-CSRF-Token header OR in the JSON body as `_csrf`.
 *   4. The server compares the submitted token with the one in the Session row.
 *
 * Note: SameSite=Lax already blocks cross-origin form POSTs.
 *       This layer adds defence-in-depth for XMLHttpRequest / fetch callers.
 */
import crypto from "crypto";

/** Generate a secure random CSRF token (hex string) */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Compare in constant-time to prevent timing attacks */
export function verifyCsrfToken(
  submitted: string | undefined | null,
  stored: string | undefined | null,
): boolean {
  if (!submitted || !stored) return false;
  // Pad to same length so timingSafeEqual doesn't throw
  const a = Buffer.from(submitted.padEnd(64, "0"), "utf8").subarray(0, 64);
  const b = Buffer.from(stored.padEnd(64, "0"),    "utf8").subarray(0, 64);
  return crypto.timingSafeEqual(a, b);
}

/** Extract CSRF token from request (header preferred over body) */
export function extractCsrfFromRequest(
  req: Request,
  parsedBody?: Record<string, unknown>,
): string | undefined {
  const fromHeader = req.headers.get("x-csrf-token") ?? undefined;
  if (fromHeader) return fromHeader;
  if (parsedBody && typeof parsedBody["_csrf"] === "string") {
    return parsedBody["_csrf"];
  }
  return undefined;
}
