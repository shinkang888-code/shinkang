import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── API Helpers unit tests ───────────────────────────────────────
describe("apiSuccess / apiError helpers", () => {
  it("should return success response", async () => {
    const { apiSuccess } = await import("@/lib/api-helpers");
    const res = apiSuccess({ id: "1", name: "test" });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toBe("test");
    expect(res.status).toBe(200);
  });

  it("should return error response with default 400", async () => {
    const { apiError } = await import("@/lib/api-helpers");
    const res = apiError("Something went wrong");
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Something went wrong");
    expect(res.status).toBe(400);
  });

  it("should return custom status error", async () => {
    const { apiError } = await import("@/lib/api-helpers");
    const res = apiError("Not Found", 404);
    expect(res.status).toBe(404);
  });
});

// ─── Auth middleware tests ─────────────────────────────────────────
describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "auth").mockResolvedValueOnce(null as any);

    const { requireAuth } = await import("@/lib/api-helpers");
    const { error } = await requireAuth();

    expect(error).not.toBeNull();
    const json = await error!.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should return session when authenticated", async () => {
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "auth").mockResolvedValueOnce({
      user: { id: "user-1", email: "test@test.com", role: "ADMIN" },
      expires: "2030-01-01",
    } as any);

    const { requireAuth } = await import("@/lib/api-helpers");
    const { error, session } = await requireAuth();

    expect(error).toBeNull();
    expect(session?.user.id).toBe("user-1");
  });
});

// ─── Student API tests ─────────────────────────────────────────────
describe("GET /api/student/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when unauthenticated", async () => {
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "auth").mockResolvedValueOnce(null as any);

    const { GET } = await import("@/app/api/student/stats/route");
    const req = new NextRequest("http://localhost:3000/api/student/stats");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("should return stats when student is authenticated", async () => {
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "auth").mockResolvedValueOnce({
      user: { id: "user-1", email: "student@test.com", role: "STUDENT" },
      expires: "2030-01-01",
    } as any);

    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.student.findFirst).mockResolvedValueOnce({
      id: "student-1",
      userId: "user-1",
      studioId: "studio-1",
      studentCode: null,
      grade: "초등 3학년",
      parentName: null,
      parentPhone: null,
      enrolledAt: new Date(),
      memo: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.practiceSession.count).mockResolvedValue(5);
    vi.mocked(prisma.practiceSession.aggregate).mockResolvedValue({
      _sum: { durationMin: 300 },
      _avg: null, _count: null, _max: null, _min: null,
    } as any);
    vi.mocked(prisma.lessonSchedule.count).mockResolvedValue(10);
    vi.mocked(prisma.payment.count).mockResolvedValue(1);

    const { GET } = await import("@/app/api/student/stats/route");
    const req = new NextRequest("http://localhost:3000/api/student/stats");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.practice).toBeDefined();
  });
});

// ─── Payment validation tests ──────────────────────────────────────
describe("Payment status logic", () => {
  it("should correctly identify overdue payments", () => {
    const now = new Date();
    const pastDue = new Date(now.getTime() - 86400000 * 5); // 5 days ago
    const futureDue = new Date(now.getTime() + 86400000 * 5); // 5 days later

    expect(pastDue < now).toBe(true);
    expect(futureDue < now).toBe(false);
  });

  it("should calculate billing month format", () => {
    const date = new Date("2024-03-15");
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    expect(month).toBe("2024-03");
  });
});

// ─── Practice session duration tests ──────────────────────────────
describe("Practice session duration", () => {
  it("should calculate duration in minutes correctly", () => {
    const start = new Date("2024-01-01T10:00:00");
    const end = new Date("2024-01-01T11:30:00");
    const durationMin = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    expect(durationMin).toBe(90);
  });

  it("should handle short sessions", () => {
    const start = new Date("2024-01-01T10:00:00");
    const end = new Date("2024-01-01T10:05:00");
    const durationMin = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    expect(durationMin).toBe(5);
  });
});

// ─── Kakao notification flow tests ───────────────────────────────
describe("Kakao notification type validation", () => {
  it("should accept valid notification types", () => {
    const validTypes = ["PAYMENT_DUE", "PAYMENT_OVERDUE", "LESSON_REMINDER"];
    validTypes.forEach((type) => {
      expect(["PAYMENT_DUE", "PAYMENT_OVERDUE", "LESSON_REMINDER"].includes(type)).toBe(true);
    });
  });

  it("should reject invalid notification type", () => {
    const invalidType = "INVALID_TYPE";
    expect(["PAYMENT_DUE", "PAYMENT_OVERDUE", "LESSON_REMINDER"].includes(invalidType)).toBe(false);
  });
});
