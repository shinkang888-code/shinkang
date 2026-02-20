import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";

// GET /api/student/payments?month=2024-01
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const month = new URL(req.url).searchParams.get("month");

  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id },
  });
  if (!student) return apiError("Student not found", 404);

  const payments = await prisma.payment.findMany({
    where: {
      studentId: student.id,
      ...(month && { billingMonth: month }),
    },
    orderBy: { billingMonth: "desc" },
  });

  return apiSuccess(payments);
}
