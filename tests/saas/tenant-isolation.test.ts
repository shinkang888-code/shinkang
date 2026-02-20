/**
 * SaaS Multi-Tenant Isolation Tests
 * ─────────────────────────────────────────────────────────────────
 * Test 1: A학원 유저가 B학원 유저 목록을 조회하면 403
 * Test 2: SUPER_ADMIN은 모든 학원 목록 조회 가능
 * Test 3: 정지된 academy 소속 유저 로그인 차단
 * ─────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { saasPrisma } from "../../src/saas/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  generateJti,
  refreshExpiry,
} from "../../src/saas/lib/jwt";
import bcrypt from "bcryptjs";

// ─── Test data IDs ────────────────────────────────────────────────
const IDS = {
  academyA: "test-academy-a-" + Date.now(),
  academyB: "test-academy-b-" + Date.now(),
  suspendedAcademy: "test-academy-sus-" + Date.now(),
  adminA: "test-user-admin-a-" + Date.now(),
  adminB: "test-user-admin-b-" + Date.now(),
  superAdmin: "test-super-" + Date.now(),
  suspendedUser: "test-user-sus-" + Date.now(),
};

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const PW = "Test1234!";
let pwHash: string;

// Token storage
const tokens: Record<string, string> = {};

// ─── Setup ────────────────────────────────────────────────────────

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);

  // Create Academies
  await saasPrisma.academy.createMany({
    data: [
      { id: IDS.academyA, name: "Alpha Academy", code: `alpha-${Date.now()}`, status: "ACTIVE" },
      { id: IDS.academyB, name: "Beta Academy",  code: `beta-${Date.now()}`,  status: "ACTIVE" },
      { id: IDS.suspendedAcademy, name: "Suspended Academy", code: `sus-${Date.now()}`, status: "SUSPENDED" },
    ],
    skipDuplicates: true,
  });

  // Create Users
  await saasPrisma.saasUser.createMany({
    data: [
      {
        id: IDS.adminA,
        academyId: IDS.academyA,
        role: "ADMIN",
        name: "Admin A",
        email: `admin-a-${Date.now()}@test.com`,
        passwordHash: pwHash,
        status: "ACTIVE",
      },
      {
        id: IDS.adminB,
        academyId: IDS.academyB,
        role: "ADMIN",
        name: "Admin B",
        email: `admin-b-${Date.now()}@test.com`,
        passwordHash: pwHash,
        status: "ACTIVE",
      },
      {
        id: IDS.superAdmin,
        academyId: null,
        role: "SUPER_ADMIN",
        name: "Super Admin",
        email: `super-${Date.now()}@test.com`,
        passwordHash: pwHash,
        status: "ACTIVE",
      },
      {
        id: IDS.suspendedUser,
        academyId: IDS.suspendedAcademy,
        role: "STUDENT",
        name: "Suspended Student",
        email: `sus-student-${Date.now()}@test.com`,
        passwordHash: pwHash,
        status: "ACTIVE",
      },
    ],
    skipDuplicates: true,
  });

  // Pre-sign tokens for A and SuperAdmin (bypass HTTP login for speed)
  tokens.adminA = await signAccessToken({
    sub: IDS.adminA,
    email: `admin-a@test.com`,
    role: "ADMIN",
    academyId: IDS.academyA,
    name: "Admin A",
  });

  tokens.superAdmin = await signAccessToken({
    sub: IDS.superAdmin,
    email: `super@test.com`,
    role: "SUPER_ADMIN",
    academyId: null,
    name: "Super Admin",
  });
});

afterAll(async () => {
  // Cleanup test data
  const userIds = Object.values(IDS).filter((id) => id.startsWith("test-user"));
  const academyIds = Object.values(IDS).filter((id) => id.startsWith("test-academy"));
  await saasPrisma.auditLog.deleteMany({ where: { academyId: { in: academyIds } } });
  await saasPrisma.saasUser.deleteMany({ where: { id: { in: userIds } } });
  await saasPrisma.academy.deleteMany({ where: { id: { in: academyIds } } });
  await saasPrisma.$disconnect();
});

// ─── Helper ───────────────────────────────────────────────────────

async function apiFetch(
  path: string,
  token: string,
  method = "GET",
  body?: object
) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─── Tests ────────────────────────────────────────────────────────

describe("SaaS Multi-Tenant Isolation", () => {

  /**
   * Test 1: Tenant scope violation
   * Admin A (academyA) calls GET /api/saas/academies/me/users
   * → Should only see academyA users (never B's)
   * AND if Admin A somehow constructs a request with academyB scope
   * → assertTenantScope returns 403
   */
  it("Test 1: Admin A cannot see Admin B's user list (tenant isolation)", async () => {
    // Admin A hits their own academy endpoint — should succeed
    const res = await apiFetch("/api/saas/academies/me/users", tokens.adminA);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // All returned users must belong to academyA
    const users: Array<{ id: string }> = data.data.users;
    expect(users.every((u) => u.id !== IDS.adminB)).toBe(true);

    // Direct attempt: Admin A tries to PATCH a user in academyB
    const scopeViolationRes = await apiFetch(
      `/api/saas/academies/me/users/${IDS.adminB}`,
      tokens.adminA,
      "PATCH",
      { name: "Hacked Name" }
    );
    // Must be 403 because adminB belongs to academyB, not academyA
    expect(scopeViolationRes.status).toBe(403);
    const errData = await scopeViolationRes.json();
    expect(errData.success).toBe(false);
    expect(errData.error).toMatch(/forbidden|tenant|scope/i);
  });

  /**
   * Test 2: SUPER_ADMIN can list all academies
   */
  it("Test 2: SUPER_ADMIN can view all academies", async () => {
    const res = await apiFetch("/api/saas/admin/academies", tokens.superAdmin);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.academies)).toBe(true);
    // SuperAdmin sees ALL academies including test ones
    expect(data.data.pagination.total).toBeGreaterThan(0);

    // Also verify SuperAdmin can see all users
    const usersRes = await apiFetch("/api/saas/admin/users", tokens.superAdmin);
    expect(usersRes.status).toBe(200);
    const usersData = await usersRes.json();
    expect(usersData.success).toBe(true);
    expect(usersData.data.pagination.total).toBeGreaterThan(1);
  });

  /**
   * Test 3: Suspended academy user cannot login
   */
  it("Test 3: User in suspended academy cannot login", async () => {
    // Fetch the suspended user's email
    const suspendedUser = await saasPrisma.saasUser.findUnique({
      where: { id: IDS.suspendedUser },
    });
    expect(suspendedUser).not.toBeNull();

    const res = await fetch(`${BASE}/api/saas/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: suspendedUser!.email,
        password: PW,
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/suspended/i);
  });

});
