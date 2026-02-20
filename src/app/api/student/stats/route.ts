import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";

// GET /api/student/stats
export async function GET(_req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const student = await prisma.student.findFirst({
    where: { userId: session!.user.id },
  });
  if (!student) return apiError("Student not found", 404);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [
    totalSessions,
    monthlySessions,
    weeklySessions,
    totalMinutes,
    monthlyMinutes,
    completedLessons,
    pendingPayments,
  ] = await Promise.all([
    prisma.practiceSession.count({ where: { studentId: student.id, endedAt: { not: null } } }),
    prisma.practiceSession.count({
      where: {
        studentId: student.id,
        startedAt: { gte: monthStart, lte: monthEnd },
        endedAt: { not: null },
      },
    }),
    prisma.practiceSession.count({
      where: {
        studentId: student.id,
        startedAt: { gte: weekStart, lte: weekEnd },
        endedAt: { not: null },
      },
    }),
    prisma.practiceSession.aggregate({
      where: { studentId: student.id, endedAt: { not: null } },
      _sum: { durationMin: true },
    }),
    prisma.practiceSession.aggregate({
      where: {
        studentId: student.id,
        startedAt: { gte: monthStart, lte: monthEnd },
        endedAt: { not: null },
      },
      _sum: { durationMin: true },
    }),
    prisma.lessonSchedule.count({
      where: { studentId: student.id, status: "COMPLETED" },
    }),
    prisma.payment.count({
      where: {
        studentId: student.id,
        status: { in: ["PENDING", "OVERDUE"] },
      },
    }),
  ]);

  return apiSuccess({
    practice: {
      totalSessions,
      monthlySessions,
      weeklySessions,
      totalMinutes: totalMinutes._sum.durationMin ?? 0,
      monthlyMinutes: monthlyMinutes._sum.durationMin ?? 0,
    },
    lessons: { completedLessons },
    payments: { pendingPayments },
  });
}
