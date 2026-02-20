/**
 * src/lib/auth/login-lock.ts
 *
 * Account lockout after N consecutive failed login attempts.
 * State is persisted in the login_attempts table (survives restarts).
 *
 * Flow:
 *   1. Before verify: checkLock(email) → throws if locked
 *   2. On failed verify: recordFailure(email, ip)
 *   3. On success: clearFailures(email)
 */
import { prisma } from "@/lib/db/client";

const MAX_ATTEMPTS = Number(process.env.LOGIN_LOCKOUT_ATTEMPTS ?? 5);
const LOCK_DURATION_MS = Number(
  process.env.LOGIN_LOCKOUT_DURATION_MS ?? 15 * 60 * 1000,
); // 15 min

/** Returns null if not locked, or the lockedUntil Date if locked */
export async function getLockStatus(
  email: string,
): Promise<{ locked: boolean; until?: Date }> {
  const windowStart = new Date(Date.now() - LOCK_DURATION_MS);

  const failures = await prisma.loginAttempt.count({
    where: {
      email,
      success:   false,
      createdAt: { gte: windowStart },
    },
  });

  if (failures < MAX_ATTEMPTS) return { locked: false };

  // Find the most recent failure to calculate expiry
  const latest = await prisma.loginAttempt.findFirst({
    where: { email, success: false, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
  });

  const until = latest
    ? new Date(latest.createdAt.getTime() + LOCK_DURATION_MS)
    : new Date();

  if (until > new Date()) return { locked: true, until };
  return { locked: false };
}

export async function recordFailure(email: string, ip?: string) {
  await prisma.loginAttempt.create({
    data: { email, ip: ip ?? null, success: false },
  });
}

export async function recordSuccess(email: string, ip?: string) {
  // Create a success record and prune old failures
  await prisma.loginAttempt.create({
    data: { email, ip: ip ?? null, success: true },
  });
  // Clear failure records so the lock resets
  await prisma.loginAttempt.deleteMany({
    where: { email, success: false },
  });
}
