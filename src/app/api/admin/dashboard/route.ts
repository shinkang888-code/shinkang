import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, verifyStudioAccess, apiSuccess, apiError } from "@/lib/api-helpers";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";

// GET /api/admin/dashboard?studioId=xxx
export async function GET(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const studioId = new URL(req.url).searchParams.get("studioId");
  if (!studioId) return apiError("studioId is required");

  const hasAccess = await verifyStudioAccess(session!.user.id, studioId);
  if (!hasAccess) return apiError("Forbidden", 403);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    totalStudents,
    activeStudents,
    payments,
    todaySchedules,
    monthlyPractice,
    recentPayments,
  ] = await Promise.all([
    prisma.student.count({ where: { studioId } }),
    prisma.student.count({ where: { studioId, isActive: true } }),
    prisma.payment.findMany({
      where: { student: { studioId }, billingMonth: now.toISOString().slice(0, 7) },
      select: { amount: true, status: true },
    }),
    prisma.lessonSchedule.count({
      where: {
        lesson: { studioId },
        startAt: { gte: todayStart, lte: todayEnd },
        status: "SCHEDULED",
      },
    }),
    prisma.practiceSession.count({
      where: {
        student: { studioId },
        startedAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.payment.findMany({
      where: { student: { studioId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        student: { include: { user: { select: { name: true } } } },
      },
    }),
  ]);

  const totalRevenue = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingPayments = payments.filter((p) => p.status === "PENDING").length;
  const overduePayments = payments.filter((p) => p.status === "OVERDUE").length;

  return apiSuccess({
    stats: {
      totalStudents,
      activeStudents,
      totalRevenue,
      pendingPayments,
      overduePayments,
      todayLessons: todaySchedules,
      monthlyPracticeSessions: monthlyPractice,
    },
    recentPayments,
  });
}
