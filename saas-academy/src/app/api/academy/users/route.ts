/**
 * GET  /api/academy/users?search=&role=&status=&page=
 * POST /api/academy/users
 * ADMIN only — scoped to own academy via tenant Prisma extension.
 */
import { NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { hashPassword } from "@/lib/auth/password";
import { CreateUserSchema } from "@/lib/validators/auth";
import { audit } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "TEACHER", "SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  // TEACHER can see students only; ADMIN sees all
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  // TEACHER can only see STUDENT list
  if (ctx.user.role === "TEACHER") {
    where.role = "STUDENT";
  } else if (role) {
    where.role = role;
  }
  if (status) where.status = status;

  // scopedPrisma auto-injects academyId WHERE clause
  const [users, total] = await Promise.all([
    ctx.db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true,
        role: true, status: true, createdAt: true,
      },
    }),
    ctx.db.user.count({ where }),
  ]);

  return ok({ users, total, page, limit });
}

export async function POST(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const body = await parseBody(req, CreateUserSchema);
  if (body instanceof Response) return body;

  const { name, email, password, role } = body;

  // Check email uniqueness globally
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return err("Email already in use", 409);

  // scopedPrisma.user.create will auto-inject academyId
  const user = await ctx.db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: role as any,
    },
    select: {
      id: true, name: true, email: true,
      role: true, status: true, academyId: true, createdAt: true,
    },
  });

  await audit({
    actorUserId: ctx.user.sub,
    academyId: ctx.academyId,
    action: "user.create",
    targetType: "User",
    targetId: user.id,
    metaJson: { role },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return ok(user, 201);
}
