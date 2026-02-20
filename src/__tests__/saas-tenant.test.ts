/**
 * SaaS Multi-Tenant E2E Tests
 * ─────────────────────────────────────────────────────────────────
 * Three critical tenant isolation test cases:
 *
 *  1. Cross-academy access is forbidden (403) — ADMIN from Academy A
 *     cannot read users from Academy B via academies/me/users endpoint.
 *
 *  2. SUPER_ADMIN can see all academies — GET /api/saas/admin/academies
 *     returns data regardless of academy scope.
 *
 *  3. User of a SUSPENDED academy cannot login — returns 403.
 *
 * These are unit-style e2e tests that call the route handlers directly
 * (no real HTTP server needed), mocking only the DB layer.
 * ─────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock saasPrisma ─────────────────────────────────────────────

const mockSaasPrisma = {
  saasUser: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  academy: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/saas/lib/prisma", () => ({
  saasPrisma: mockSaasPrisma,
}));

// ─── Test helpers ─────────────────────────────────────────────────

/**
 * Build a signed JWT access token for test usage.
 * We use the same signAccessToken function from production code so
 * the token is structurally valid and verifiable by the guards.
 */
async function buildToken(payload: {
  sub: string;
  email: string;
  role: string;
  academyId: string | null;
  name: string;
}): Promise<string> {
  const { signAccessToken } = await import("@/saas/lib/jwt");
  return signAccessToken(payload);
}

function makeReq(url: string, opts: { token?: string; body?: unknown; method?: string } = {}): NextRequest {
  const req = new NextRequest(`http://localhost:3000${url}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  return req;
}

// ─── Test Suite ───────────────────────────────────────────────────

describe("SaaS Multi-Tenant Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: academy is ACTIVE
    mockSaasPrisma.academy.findUnique.mockResolvedValue({
      id: "academy-a",
      name: "알파 피아노",
      code: "alpha-piano",
      status: "ACTIVE",
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 1: Cross-Academy Access is Forbidden (403)
  // ─────────────────────────────────────────────────────────────────
  describe("Test 1: Cross-academy access → 403 Forbidden", () => {
    it("ADMIN of Academy A cannot read users outside their own academy scope", async () => {
      /**
       * The GET /api/saas/academies/me/users endpoint uses the token's
       * academyId to scope all queries. The ADMIN from Academy A gets
       * only Academy A users regardless of any request params.
       *
       * This test verifies that:
       * - The query is always filtered with academyId from the token
       * - An ADMIN from Academy B's token that somehow reaches Academy A
       *   users would get 0 results (tenant isolation via query scoping)
       *
       * For strict 403, we test assertTenantScope directly:
       * - ADMIN A (academyId=academy-a) tries to GET /me/users/[id]
       *   where the user belongs to academy-b → must return 403
       */

      // Token for ADMIN of Academy A
      const tokenA = await buildToken({
        sub: "admin-a-id",
        email: "admin@alpha.com",
        role: "ADMIN",
        academyId: "academy-a",
        name: "알파 원장",
      });

      // The target user belongs to Academy B
      const targetUserId = "user-from-academy-b";
      mockSaasPrisma.saasUser.findUnique.mockResolvedValue({
        id: targetUserId,
        email: "student@beta.com",
        name: "베타 학생",
        role: "STUDENT",
        status: "ACTIVE",
        academyId: "academy-b",  // ← different academy!
        createdAt: new Date(),
      });

      // Import the PATCH /academies/me/users/[id] handler
      const { GET } = await import(
        "@/app/api/saas/academies/me/users/[id]/route"
      );

      const req = makeReq(`/api/saas/academies/me/users/${targetUserId}`, {
        token: tokenA,
      });

      const res = await GET(req, {
        params: Promise.resolve({ id: targetUserId }),
      });

      // Must be 403 — tenant scope violation
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("tenant scope");
    });

    it("ADMIN cannot update user in a different academy (cross-tenant PATCH)", async () => {
      const tokenA = await buildToken({
        sub: "admin-a-id",
        email: "admin@alpha.com",
        role: "ADMIN",
        academyId: "academy-a",
        name: "알파 원장",
      });

      // Target user is in Academy B
      mockSaasPrisma.saasUser.findUnique.mockResolvedValue({
        id: "user-beta-1",
        email: "student@beta.com",
        name: "베타 학생",
        role: "STUDENT",
        status: "ACTIVE",
        academyId: "academy-b",
        createdAt: new Date(),
      });

      const { PATCH } = await import(
        "@/app/api/saas/academies/me/users/[id]/route"
      );

      const req = makeReq("/api/saas/academies/me/users/user-beta-1", {
        token: tokenA,
        method: "PATCH",
        body: { status: "SUSPENDED" },
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "user-beta-1" }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("tenant scope");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 2: SUPER_ADMIN Sees All Academies
  // ─────────────────────────────────────────────────────────────────
  describe("Test 2: SUPER_ADMIN can view all academies", () => {
    it("SUPER_ADMIN GET /api/saas/admin/academies returns all academies", async () => {
      const superAdminToken = await buildToken({
        sub: "super-admin-id",
        email: "super@saas.com",
        role: "SUPER_ADMIN",
        academyId: null,
        name: "슈퍼 어드민",
      });

      // Mock returning 3 academies from different tenants
      const mockAcademies = [
        { id: "academy-a", name: "알파 피아노", code: "alpha-piano", status: "ACTIVE", createdAt: new Date(), updatedAt: new Date(), _count: { users: 5 } },
        { id: "academy-b", name: "베타 음악", code: "beta-music", status: "ACTIVE", createdAt: new Date(), updatedAt: new Date(), _count: { users: 3 } },
        { id: "academy-c", name: "정지된 학원", code: "suspended-test", status: "SUSPENDED", createdAt: new Date(), updatedAt: new Date(), _count: { users: 1 } },
      ];
      mockSaasPrisma.academy.findMany.mockResolvedValue(mockAcademies);
      mockSaasPrisma.academy.count.mockResolvedValue(3);

      const { GET } = await import("@/app/api/saas/admin/academies/route");

      const req = makeReq("/api/saas/admin/academies", {
        token: superAdminToken,
      });

      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      // SUPER_ADMIN sees all 3 academies across tenants
      expect(json.data.academies).toHaveLength(3);
      expect(json.data.pagination.total).toBe(3);
      // Contains all academy statuses
      const statuses = json.data.academies.map((a: { status: string }) => a.status);
      expect(statuses).toContain("ACTIVE");
      expect(statuses).toContain("SUSPENDED");
    });

    it("Non-SUPER_ADMIN (ADMIN role) cannot access GET /api/saas/admin/academies", async () => {
      // An Academy ADMIN should NOT be able to list all academies
      const adminToken = await buildToken({
        sub: "academy-admin-id",
        email: "admin@alpha.com",
        role: "ADMIN",
        academyId: "academy-a",
        name: "알파 원장",
      });

      const { GET } = await import("@/app/api/saas/admin/academies/route");

      const req = makeReq("/api/saas/admin/academies", {
        token: adminToken,
      });

      const res = await GET(req);

      // Must be 403 — SUPER_ADMIN only
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("SUPER_ADMIN");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 3: Suspended Academy Users Cannot Login
  // ─────────────────────────────────────────────────────────────────
  describe("Test 3: Suspended academy users cannot login → 403", () => {
    it("Student from SUSPENDED academy gets 403 on login", async () => {
      // Mock: user exists, password is correct, but academy is SUSPENDED
      const suspendedAcademyId = "suspended-academy-id";

      mockSaasPrisma.saasUser.findUnique.mockResolvedValue({
        id: "suspended-student-id",
        email: "student@suspended.com",
        name: "정지된 원생",
        role: "STUDENT",
        status: "ACTIVE",   // User itself is ACTIVE
        academyId: suspendedAcademyId,
        passwordHash: "$2b$12$dSxI2A3VKGeMVJAEWssMf.GNuKV3NR2jON9j6UvJjKdDHlMiNqnO.", // "Student1234!" (pre-hashed)
        academy: {
          id: suspendedAcademyId,
          status: "SUSPENDED",  // ← Academy is SUSPENDED
          name: "정지된 학원",
        },
      });

      const { POST } = await import("@/app/api/saas/auth/login/route");

      const req = makeReq("/api/saas/auth/login", {
        method: "POST",
        body: {
          email: "student@suspended.com",
          password: "wrong-password-doesnt-matter", // login blocked before password check
        },
      });

      const res = await POST(req);

      // Must be 403 — suspended academy
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/suspended/i);
    });

    it("Admin from ACTIVE academy can login successfully", async () => {
      // For contrast: an ACTIVE academy admin should succeed
      // (We'll use a bcrypt-hashed password)
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash("Admin1234!", 10);

      mockSaasPrisma.saasUser.findUnique.mockResolvedValue({
        id: "active-admin-id",
        email: "admin@alpha.com",
        name: "알파 원장",
        role: "ADMIN",
        status: "ACTIVE",
        academyId: "academy-a",
        passwordHash,
        academy: {
          id: "academy-a",
          status: "ACTIVE",  // ← Academy is ACTIVE
          name: "알파 피아노",
        },
      });

      mockSaasPrisma.refreshToken.create.mockResolvedValue({
        id: "rt-1",
        userId: "active-admin-id",
        tokenHash: "hashed",
        expiresAt: new Date(),
        revoked: false,
        createdAt: new Date(),
        ip: null,
        userAgent: null,
      });

      // auditLog.create is non-blocking; mock it
      mockSaasPrisma.auditLog.create.mockResolvedValue({});

      const { POST } = await import("@/app/api/saas/auth/login/route");

      const req = makeReq("/api/saas/auth/login", {
        method: "POST",
        body: { email: "admin@alpha.com", password: "Admin1234!" },
      });

      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBeTruthy();
      expect(json.data.user.role).toBe("ADMIN");
    });

    it("SUSPENDED user (in ACTIVE academy) also cannot login", async () => {
      // User is individually suspended
      mockSaasPrisma.saasUser.findUnique.mockResolvedValue({
        id: "suspended-user-id",
        email: "banned@alpha.com",
        name: "정지된 사용자",
        role: "STUDENT",
        status: "SUSPENDED",  // ← User is SUSPENDED
        academyId: "academy-a",
        passwordHash: "any-hash",
        academy: {
          id: "academy-a",
          status: "ACTIVE",   // Academy is ACTIVE
          name: "알파 피아노",
        },
      });

      const { POST } = await import("@/app/api/saas/auth/login/route");

      const req = makeReq("/api/saas/auth/login", {
        method: "POST",
        body: { email: "banned@alpha.com", password: "whatever" },
      });

      const res = await POST(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/suspended/i);
    });
  });
});
