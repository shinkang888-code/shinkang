import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, verifyStudioAccess, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

const createPaymentSchema = z.object({
  studentId: z.string().min(1),
  studioId: z.string().min(1),
  amount: z.number().positive(),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  dueDate: z.string().datetime(),
  memo: z.string().optional(),
});

// GET /api/admin/payments?studioId=xxx&month=2024-01&status=PENDING
export async function GET(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const studioId = searchParams.get("studioId");
  const month = searchParams.get("month");
  const status = searchParams.get("status");

  if (!studioId) return apiError("studioId is required");

  const hasAccess = await verifyStudioAccess(session!.user.id, studioId);
  if (!hasAccess) return apiError("Forbidden", 403);

  const payments = await prisma.payment.findMany({
    where: {
      student: { studioId },
      ...(month && { billingMonth: month }),
      ...(status && { status: status as "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" }),
    },
    include: {
      student: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: [{ billingMonth: "desc" }, { dueDate: "asc" }],
  });

  // 연체 자동 업데이트
  const now = new Date();
  const overdueIds = payments
    .filter((p) => p.status === "PENDING" && p.dueDate < now)
    .map((p) => p.id);

  if (overdueIds.length > 0) {
    await prisma.payment.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: "OVERDUE" },
    });
    overdueIds.forEach((id) => {
      const p = payments.find((x) => x.id === id);
      if (p) p.status = "OVERDUE";
    });
  }

  return apiSuccess(payments);
}

// POST /api/admin/payments — 수강료 생성
export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const hasAccess = await verifyStudioAccess(session!.user.id, parsed.data.studioId);
  if (!hasAccess) return apiError("Forbidden", 403);

  const payment = await prisma.payment.create({
    data: {
      studentId: parsed.data.studentId,
      amount: parsed.data.amount,
      billingMonth: parsed.data.billingMonth,
      dueDate: new Date(parsed.data.dueDate),
      memo: parsed.data.memo,
    },
    include: {
      student: { include: { user: { select: { name: true } } } },
    },
  });

  return apiSuccess(payment, 201);
}
