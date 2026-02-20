// Domain types mirroring Prisma models + UI-specific shapes

export type Role = "ADMIN" | "STUDENT";
export type ScheduleStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "ABSENT";
export type PaymentStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER";
export type NotificationType = "PAYMENT_DUE" | "PAYMENT_OVERDUE" | "LESSON_REMINDER" | "GENERAL";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export interface StudioDTO {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  adminId: string;
  isActive: boolean;
  createdAt: string;
}

export interface StudentDTO {
  id: string;
  userId: string;
  studioId: string;
  studentCode?: string | null;
  grade?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  enrolledAt: string;
  memo?: string | null;
  isActive: boolean;
  user: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    profileImage?: string | null;
  };
}

export interface LessonScheduleDTO {
  id: string;
  lessonId: string;
  studentId: string;
  startAt: string;
  endAt: string;
  status: ScheduleStatus;
  memo?: string | null;
  lesson: {
    id: string;
    title: string;
    color?: string | null;
  };
  student: {
    id: string;
    user: { name?: string | null };
  };
}

export interface PaymentDTO {
  id: string;
  studentId: string;
  amount: number;
  billingMonth: string;
  dueDate: string;
  paidAt?: string | null;
  status: PaymentStatus;
  method?: PaymentMethod | null;
  memo?: string | null;
}

export interface PracticeSessionDTO {
  id: string;
  studentId: string;
  startedAt: string;
  endedAt?: string | null;
  durationMin?: number | null;
  piece?: string | null;
  memo?: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color?: string;
  extendedProps?: Record<string, unknown>;
}

export interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalRevenue: number;
  pendingPayments: number;
  overduePayments: number;
  todayLessons: number;
  monthlyPracticeSessions: number;
}
