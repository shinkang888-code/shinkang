/**
 * src/lib/validators/attendance.ts
 * Zod schemas for Class, Enrollment, Session, Attendance API payloads.
 */
import { z } from "zod";

// ─── Class ────────────────────────────────────────────────────────────────────

export const createClassSchema = z.object({
  name:          z.string().min(1).max(100),
  teacherUserId: z.string().uuid().optional().nullable(),
  capacity:      z.number().int().positive().optional().nullable(),
  startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  endDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").optional().nullable(),
  /** Weekly schedule rules (at least one required) */
  schedules: z
    .array(
      z.object({
        daysOfWeek:  z.array(z.number().int().min(0).max(6)).min(1),
        startTime:   z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
        durationMin: z.number().int().min(10).max(300),
        timezone:    z.string().default("Asia/Seoul"),
      }),
    )
    .min(1),
  /** How many weeks ahead to generate sessions (default 8) */
  generateWeeks: z.number().int().min(1).max(52).default(8),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;

export const updateClassSchema = z.object({
  name:          z.string().min(1).max(100).optional(),
  teacherUserId: z.string().uuid().optional().nullable(),
  capacity:      z.number().int().positive().optional().nullable(),
  endDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status:        z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export type UpdateClassInput = z.infer<typeof updateClassSchema>;

// ─── Enrollment ───────────────────────────────────────────────────────────────

export const enrollStudentSchema = z.object({
  studentUserId: z.string().uuid(),
});

export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;

export const updateEnrollmentSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "DROPPED"]),
});

export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;

// ─── Session ──────────────────────────────────────────────────────────────────

export const updateSessionSchema = z.object({
  status: z.enum(["SCHEDULED", "CANCELED", "COMPLETED"]),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const regenerateSessionsSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** How many weeks forward from today to generate (default 8) */
  weeks:    z.number().int().min(1).max(52).default(8),
});

export type RegenerateSessionsInput = z.infer<typeof regenerateSessionsSchema>;

// ─── Attendance ───────────────────────────────────────────────────────────────

export const attendanceEntrySchema = z.object({
  studentUserId: z.string().uuid(),
  status:        z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  memo:          z.string().max(500).optional().nullable(),
  reason:        z.string().max(500).optional().nullable(), // for update history
});

export const bulkAttendanceSchema = z.object({
  entries: z.array(attendanceEntrySchema).min(1),
});

export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;

export const listAttendanceQuerySchema = z.object({
  classId:       z.string().uuid().optional(),
  sessionId:     z.string().uuid().optional(),
  studentUserId: z.string().uuid().optional(),
  month:         z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
  page:          z.coerce.number().int().min(1).default(1),
  limit:         z.coerce.number().int().min(1).max(200).default(50),
});

export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;

export const listSessionsQuerySchema = z.object({
  classId:   z.string().uuid().optional(),
  month:     z.string().regex(/^\d{4}-\d{2}$/).optional(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status:    z.enum(["SCHEDULED", "CANCELED", "COMPLETED"]).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(200).default(50),
});

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
