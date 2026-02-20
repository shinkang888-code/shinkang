import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

const createStudioSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
});

// GET /api/admin/studios — 내 학원 목록
export async function GET() {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const studios = await prisma.studio.findMany({
    where: { adminId: session!.user.id, isActive: true },
    include: {
      _count: { select: { students: true, lessons: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(studios);
}

// POST /api/admin/studios — 학원 생성
export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createStudioSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const studio = await prisma.studio.create({
    data: {
      ...parsed.data,
      adminId: session!.user.id,
    },
  });

  return apiSuccess(studio, 201);
}
