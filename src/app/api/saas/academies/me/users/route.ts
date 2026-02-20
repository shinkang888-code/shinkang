/**
 * GET  /api/saas/academies/me/users  — list users in MY academy (ADMIN/TEACHER)
 * POST /api/saas/academies/me/users  — create user in MY academy (ADMIN only)
 *
 * Academy scoping: enforced via token.academyId — no other academy data visible
 */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import {
  requireAcademyAdmin,
  requireTeacherOrAbove,
  saasOk,
  saasError,
  writeAuditLog,
  TenantSuspendedError,
} from "@/saas/guards";
import { saasPrisma } from "@/saas/lib/prisma";
import { CreateUserSchema, UserQuerySchema } from "@/saas/lib/schemas";

export async function GET(req: NextRequest) {
  // TEACHER and above can list students
  let auth;
  try {
    auth = await requireTeacherOrAbove(req);
  } catch (e) {
    if (e instanceof TenantSuspendedError) {
      return saasError(e.message, 403);
    }
    throw e;
  }
  if ("error" in auth) return auth.error;

  const academyId = auth.user.academyId!;
  const qs = Object.fromEntries(req.nextUrl.searchParams.entries());
  const query = UserQuerySchema.safeParse(qs);
  if (!query.success) return saasError("Invalid query", 400, query.error.flatten());

  const { search, role, status, page, pageSize } = query.data;
  const skip = (page - 1) * pageSize;

  // ⚡ Academy scope: always filter by this academyId — tenant isolation enforced here
  const where = {
    academyId,                     // ← TENANT SCOPE ALWAYS APPLIED
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
  };

  const [users, total] = await Promise.all([
    saasPrisma.saasUser.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, name: true,
        role: true, status: true, createdAt: true,
      },
    }),
    saasPrisma.saasUser.count({ where }),
  ]);

  return saasOk({
    users,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAcademyAdmin(req);
  } catch (e) {
    if (e instanceof TenantSuspendedError) return saasError(e.message, 403);
    throw e;
  }
  if ("error" in auth) return auth.error;

  const academyId = auth.user.academyId!;

  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) return saasError("Validation failed", 400, parsed.error.flatten());

  const existing = await saasPrisma.saasUser.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return saasError("Email already exists", 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await saasPrisma.saasUser.create({
    data: {
      academyId,           // ← always scoped to actor's academy
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
    select: {
      id: true, email: true, name: true, role: true,
      status: true, academyId: true, createdAt: true,
    },
  });

  await writeAuditLog({
    actorUserId: auth.user.sub,
    academyId,
    action: "user.create",
    targetType: "user",
    targetId: user.id,
    metadata: { role: parsed.data.role } as Record<string, unknown>,
  });

  return saasOk({ user }, 201);
}
