import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, verifyStudioAccess, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";
import {
  sendPaymentDueNotification,
  sendPaymentOverdueNotification,
  sendLessonReminderNotification,
} from "@/services/kakao";

const sendSchema = z.object({
  studioId: z.string().min(1),
  type: z.enum(["PAYMENT_DUE", "PAYMENT_OVERDUE", "LESSON_REMINDER"]),
  targetStudentIds: z.array(z.string()).optional(), // null = 전체 발송
});

// POST /api/admin/notifications/send
export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { studioId, type, targetStudentIds } = parsed.data;

  const hasAccess = await verifyStudioAccess(session!.user.id, studioId);
  if (!hasAccess) return apiError("Forbidden", 403);

  const results: { studentId: string; status: string }[] = [];

  if (type === "PAYMENT_DUE" || type === "PAYMENT_OVERDUE") {
    const status = type === "PAYMENT_DUE" ? "PENDING" : "OVERDUE";
    const now = new Date();

    const payments = await prisma.payment.findMany({
      where: {
        student: {
          studioId,
          ...(targetStudentIds && { id: { in: targetStudentIds } }),
        },
        status,
      },
      include: {
        student: { include: { user: { select: { name: true } } } },
      },
    });

    for (const payment of payments) {
      if (type === "PAYMENT_DUE") {
        await sendPaymentDueNotification(
          payment.studentId,
          payment.id,
          payment.student.user.name ?? "원생",
          payment.amount,
          payment.dueDate
        );
      } else {
        const overdueDays = Math.floor(
          (now.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        await sendPaymentOverdueNotification(
          payment.studentId,
          payment.id,
          payment.student.user.name ?? "원생",
          payment.amount,
          overdueDays
        );
      }
      results.push({ studentId: payment.studentId, status: "queued" });
    }
  }

  if (type === "LESSON_REMINDER") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
    const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));

    const schedules = await prisma.lessonSchedule.findMany({
      where: {
        lesson: { studioId },
        startAt: { gte: tomorrowStart, lte: tomorrowEnd },
        status: "SCHEDULED",
        ...(targetStudentIds && { studentId: { in: targetStudentIds } }),
      },
      include: {
        lesson: true,
        student: { include: { user: { select: { name: true } } } },
      },
    });

    for (const schedule of schedules) {
      await sendLessonReminderNotification(
        schedule.studentId,
        schedule.student.user.name ?? "원생",
        schedule.lesson.title,
        schedule.startAt
      );
      results.push({ studentId: schedule.studentId, status: "queued" });
    }
  }

  return apiSuccess({ sent: results.length, results });
}
