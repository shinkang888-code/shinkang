import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

interface Params {
  params: Promise<{ paymentId: string }>;
}

const updateSchema = z.object({
  status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  paidAt: z.string().datetime().optional().nullable(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().datetime().optional(),
  memo: z.string().optional(),
});

// PATCH /api/admin/payments/[paymentId] — 납부 처리
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { paymentId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: { include: { studio: true } } },
  });
  if (!payment) return apiError("Payment not found", 404);
  if (payment.student.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "PAID" && !parsed.data.paidAt) {
    data.paidAt = new Date();
  }
  if (parsed.data.dueDate) {
    data.dueDate = new Date(parsed.data.dueDate);
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data,
    include: {
      student: { include: { user: { select: { name: true } } } },
    },
  });

  return apiSuccess(updated);
}

// DELETE /api/admin/payments/[paymentId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const { paymentId } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: { include: { studio: true } } },
  });
  if (!payment) return apiError("Payment not found", 404);
  if (payment.student.studio.adminId !== session!.user.id) return apiError("Forbidden", 403);

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "CANCELLED" },
  });

  return apiSuccess({ message: "Payment cancelled" });
}
