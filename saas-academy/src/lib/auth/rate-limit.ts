/**
 * src/lib/auth/rate-limit.ts
 *
 * In-process sliding-window rate limiter.
 * For multi-instance deployments, swap the Map for Redis (ioredis).
 *
 * Usage:
 *   const ok = await rateLimit(ip, "login", 10, 60_000);
 *   if (!ok) return 429
 */

interface Window {
  timestamps: number[]; // epoch ms of each hit within the window
}

const store = new Map<string, Window>();

/**
 * Returns true if the request is allowed, false if rate-limited.
 *
 * @param key          Unique key, e.g. `${ip}:${action}`
 * @param maxRequests  Max allowed hits in the window
 * @param windowMs     Rolling window duration in milliseconds
 */
export function rateLimit(
  key:         string,
  maxRequests: number,
  windowMs:    number,
): boolean {
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };

  // Drop timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    store.set(key, entry);
    return false; // rate-limited
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return true; // allowed
}

/** Build a rate-limit key from a request */
export function rateLimitKey(req: Request, action: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return `${ip}:${action}`;
}

// Periodic cleanup to prevent unbounded growth (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const defaultWindow =
      Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
    for (const [k, v] of store.entries()) {
      if (v.timestamps.every((t) => now - t >= defaultWindow)) {
        store.delete(k);
      }
    }
  }, 5 * 60 * 1000);
}
