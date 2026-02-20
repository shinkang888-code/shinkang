/**
 * GET  /api/admin/users?search=&role=&status=&academyId=&page=&limit=
 * SUPER_ADMIN only — unscoped full user list.
 */
import { NextRequest } from "next/server";
import { guardRoute, ok } from "@/lib/guards/route-guard";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["SUPER_ADMIN"]);
  if (ctx instanceof Response) return ctx;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const academyId = searchParams.get("academyId");
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
  if (role) where.role = role;
  if (status) where.status = status;
  if (academyId) where.academyId = academyId;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        academyId: true, createdAt: true,
        academy: { select: { name: true, code: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ok({ users, total, page, limit });
}
