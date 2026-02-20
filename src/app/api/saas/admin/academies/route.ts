/**
 * GET  /api/saas/admin/academies  — list academies (SUPER_ADMIN)
 * POST /api/saas/admin/academies  — create academy (SUPER_ADMIN)
 */
import { NextRequest } from "next/server";
import { requireSuperAdmin, saasOk, saasError, writeAuditLog } from "@/saas/guards";
import { saasPrisma } from "@/saas/lib/prisma";
import { CreateAcademySchema, AcademyQuerySchema } from "@/saas/lib/schemas";

// ─── GET ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  const qs = Object.fromEntries(req.nextUrl.searchParams.entries());
  const query = AcademyQuerySchema.safeParse(qs);
  if (!query.success) return saasError("Invalid query", 400, query.error.flatten());

  const { search, status, page, pageSize } = query.data;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  };

  const [academies, total] = await Promise.all([
    saasPrisma.academy.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true } },
      },
    }),
    saasPrisma.academy.count({ where }),
  ]);

  return saasOk({
    academies,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

// ─── POST ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await req.json(); } catch {
    return saasError("Invalid JSON", 400);
  }

  const parsed = CreateAcademySchema.safeParse(body);
  if (!parsed.success) return saasError("Validation failed", 400, parsed.error.flatten());

  // Check code uniqueness
  const existing = await saasPrisma.academy.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing) return saasError("Academy code already exists", 409);

  const academy = await saasPrisma.academy.create({
    data: parsed.data,
  });

  await writeAuditLog({
    actorUserId: auth.user.sub,
    action: "academy.create",
    targetType: "academy",
    targetId: academy.id,
    metadata: { name: academy.name, code: academy.code },
  });

  return saasOk({ academy }, 201);
}
