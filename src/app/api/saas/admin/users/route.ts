/**
 * GET  /api/saas/admin/users  — list ALL users across all academies (SUPER_ADMIN)
 * POST /api/saas/admin/users  — create user in any academy (SUPER_ADMIN)
 */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireSuperAdmin, saasOk, saasError, writeAuditLog } from "@/saas/guards";
import { saasPrisma } from "@/saas/lib/prisma";
import { UserQuerySchema, CreateUserSchema } from "@/saas/lib/schemas";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  const qs = Object.fromEntries(req.nextUrl.searchParams.entries());
  const query = UserQuerySchema.safeParse(qs);
  if (!query.success) return saasError("Invalid query", 400, query.error.flatten());

  const { search, role, status, academyId, page, pageSize } = query.data;
  const skip = (page - 1) * pageSize;

  const where = {
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
    ...(academyId ? { academyId } : {}),
  };

  const [users, total] = await Promise.all([
    saasPrisma.saasUser.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        academyId: true,
        createdAt: true,
        academy: { select: { id: true, name: true, code: true } },
      },
    }),
    saasPrisma.saasUser.count({ where }),
  ]);

  return saasOk({
    users,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

const SuperAdminCreateUserSchema = CreateUserSchema.extend({
  academyId: z.string().uuid().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"]),
});

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const parsed = SuperAdminCreateUserSchema.safeParse(body);
  if (!parsed.success) return saasError("Validation failed", 400, parsed.error.flatten());

  const existing = await saasPrisma.saasUser.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return saasError("Email already exists", 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await saasPrisma.saasUser.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      academyId: parsed.data.academyId ?? null,
    },
    select: {
      id: true, email: true, name: true, role: true,
      academyId: true, status: true, createdAt: true,
    },
  });

  await writeAuditLog({
    actorUserId: auth.user.sub,
    academyId: parsed.data.academyId,
    action: "user.create",
    targetType: "user",
    targetId: user.id,
  });

  return saasOk({ user }, 201);
}
