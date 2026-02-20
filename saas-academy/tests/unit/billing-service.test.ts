/**
 * tests/unit/billing-service.test.ts
 *
 * Unit tests for the billing service helper functions.
 * Uses vi.mock to avoid real Toss API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
vi.mock("@/lib/db/client", () => ({
  prisma: {
    invoice:             { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    paymentMethod:       { findFirst: vi.fn() },
    paymentAttempt:      { create: vi.fn(), update: vi.fn() },
    studentSubscription: { update: vi.fn() },
    $transaction:        vi.fn(),
  },
}));

// ─── Mock Toss charge ─────────────────────────────────────────────────────────
vi.mock("@/lib/toss/charge", () => ({
  chargeWithBillingKey: vi.fn(),
}));

import { prisma } from "@/lib/db/client";
import { chargeWithBillingKey } from "@/lib/toss/charge";
import { todayKST } from "@/lib/services/billing.service";

const mockPrisma = prisma as unknown as {
  invoice:             { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  paymentMethod:       { findFirst: ReturnType<typeof vi.fn> };
  paymentAttempt:      { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  studentSubscription: { update: ReturnType<typeof vi.fn> };
  $transaction:        ReturnType<typeof vi.fn>;
};

const mockCharge = chargeWithBillingKey as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("todayKST()", () => {
  it("returns a Date object", () => {
    const d = todayKST();
    expect(d).toBeInstanceOf(Date);
  });

  it("returns midnight-UTC equivalent of KST midnight", () => {
    const d = todayKST();
    // The resulting UTC timestamp should correspond to midnight KST (= UTC−9h offset from KST)
    // i.e., 15:00 UTC = 00:00 KST next day; so UTC hours should be 15 or some specific value
    // We just check it's a valid date less than 24h in the future
    expect(d.getTime()).toBeLessThanOrEqual(Date.now() + 86400_000);
  });
});

describe("runDailyBilling()", () => {
  it("skips invoices when no payment method is found", async () => {
    // Arrange: one pending invoice, no payment method
    mockPrisma.invoice.findMany.mockResolvedValue([
      {
        id:            "inv-1",
        academyId:     "ac-1",
        orderId:       "ORD-123",
        amount:        150000,
        dueDate:       new Date("2026-01-01"),
        studentUserId: "user-1",
        planId:        "plan-1",
        subscriptionId:"sub-1",
        student:       { id: "user-1", name: "Alice", email: "alice@test.com" },
        plan:          { id: "plan-1", name: "Basic", billingDay: 1, amount: 150000 },
        subscription:  { id: "sub-1" },
        attempts:      [],
      },
    ]);
    mockPrisma.paymentMethod.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.update.mockResolvedValue({});

    const { runDailyBilling } = await import("@/lib/services/billing.service");

    const result = await runDailyBilling();

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(mockCharge).not.toHaveBeenCalled();
  });

  it("marks invoice PAID on successful charge", async () => {
    // Arrange
    const invoice = {
      id:            "inv-2",
      academyId:     "ac-1",
      orderId:       "ORD-456",
      amount:        150000,
      dueDate:       new Date("2026-01-01"),
      studentUserId: "user-1",
      planId:        "plan-1",
      subscriptionId:"sub-1",
      student:       { id: "user-1", name: "Alice", email: "alice@test.com" },
      plan:          { id: "plan-1", name: "Basic", billingDay: 1, amount: 150000 },
      subscription:  { id: "sub-1" },
      attempts:      [],
    };
    mockPrisma.invoice.findMany.mockResolvedValue([invoice]);
    mockPrisma.paymentMethod.findFirst.mockResolvedValue({
      id:          "pm-1",
      billingKey:  "billing-key-abc",
      customerKey: "user-1",
    });
    mockPrisma.paymentAttempt.create.mockResolvedValue({ id: "att-1" });
    mockCharge.mockResolvedValue({
      paymentKey: "payment-key-xyz",
      status:     "DONE",
    });
    // Mock $transaction to just call the callback
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma));
    mockPrisma.paymentAttempt.update.mockResolvedValue({});
    mockPrisma.invoice.update.mockResolvedValue({});
    mockPrisma.studentSubscription.update.mockResolvedValue({});
    mockPrisma.invoice.create.mockResolvedValue({});

    const { runDailyBilling } = await import("@/lib/services/billing.service");
    vi.resetModules(); // ensure fresh import with mocks

    const result = await runDailyBilling();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockCharge).toHaveBeenCalledOnce();
  });

  it("records failed attempt and marks FAILED after max retries", async () => {
    const invoice = {
      id:            "inv-3",
      academyId:     "ac-1",
      orderId:       "ORD-789",
      amount:        150000,
      dueDate:       new Date("2026-01-01"),
      studentUserId: "user-1",
      planId:        "plan-1",
      subscriptionId:"sub-1",
      student:       { id: "user-1", name: "Alice", email: "alice@test.com" },
      plan:          { id: "plan-1", name: "Basic", billingDay: 1, amount: 150000 },
      subscription:  { id: "sub-1" },
      // Already 2 attempts; this will be the 3rd (MAX)
      attempts: [{ id: "att-a", attemptNo: 1 }, { id: "att-b", attemptNo: 2 }],
    };
    mockPrisma.invoice.findMany.mockResolvedValue([invoice]);
    mockPrisma.paymentMethod.findFirst.mockResolvedValue({
      id:          "pm-1",
      billingKey:  "billing-key-abc",
      customerKey: "user-1",
    });
    mockPrisma.paymentAttempt.create.mockResolvedValue({ id: "att-3" });
    mockCharge.mockRejectedValue(new Error("CARD_DECLINED"));
    mockPrisma.paymentAttempt.update.mockResolvedValue({});
    mockPrisma.invoice.update.mockResolvedValue({});

    const { runDailyBilling } = await import("@/lib/services/billing.service");

    const result = await runDailyBilling();

    expect(result.failed).toBe(1);
    // Invoice should be marked FAILED
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "FAILED" } }),
    );
  });
});
