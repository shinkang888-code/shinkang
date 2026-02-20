/**
 * GET  /api/admin/academies?search=&status=&page=&limit=
 * POST /api/admin/academies
 * SUPER_ADMIN only.
 */
import { NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";
import { CreateAcademySchema } from "@/lib/validators/auth";
import { audit } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") as "ACTIVE" | "SUSPENDED" | null;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;

  const [academies, total] = await Promise.all([
    prisma.academy.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.academy.count({ where }),
  ]);

  return ok({ academies, total, page, limit });
}

export async function POST(req: NextRequest) {
  const ctx = await guardRoute(req, ["SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const body = await parseBody(req, CreateAcademySchema);
  if (body instanceof Response) return body;

  const exists = await prisma.academy.findUnique({ where: { code: body.code } });
  if (exists) return err("Academy code already exists", 409);

  const academy = await prisma.academy.create({ data: body });

  await audit({
    actorUserId: ctx.user.sub,
    academyId: academy.id,
    action: "academy.create",
    targetType: "Academy",
    targetId: academy.id,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return ok(academy, 201);
}
