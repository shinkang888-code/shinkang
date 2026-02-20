/**
 * Zod schemas for Practice domain API validation
 */

import { z } from "zod";

// ─── Common ─────────────────────────────────────────────────────────────────

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const WeekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "weekStart must be YYYY-MM-DD (Monday)");

// ─── Thread ─────────────────────────────────────────────────────────────────

export const GetThreadSchema = z.object({
  date: DateStringSchema,
  studentId: z.string().optional(), // admin use: specify student
});

// ─── Post ────────────────────────────────────────────────────────────────────

export const CreatePostSchema = z.object({
  threadId: z.string().min(1),
  studioId: z.string().min(1),
  pieceTitle: z.string().min(1, "곡 제목을 입력하세요").max(100),
  practiceCount: z.number().int().min(1).max(50).default(1),
  note: z.string().max(500).optional(),
});

export const UpdatePostSchema = z.object({
  pieceTitle: z.string().min(1).max(100).optional(),
  practiceCount: z.number().int().min(1).max(50).optional(),
  note: z.string().max(500).optional(),
});

// ─── Recording ───────────────────────────────────────────────────────────────

export const PresignSchema = z.object({
  postId: z.string().min(1),
  studioId: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024, "최대 5MB"),
  durationSec: z.number().positive().max(90, "최대 90초"),
});

export const CompleteRecordingSchema = z.object({
  postId: z.string().min(1),
  studioId: z.string().min(1),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  codec: z.string().optional(),
  durationSec: z.number().positive().max(90),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
});

// ─── Comment ─────────────────────────────────────────────────────────────────

export const CreateCommentSchema = z.object({
  threadId: z.string().min(1),
  studioId: z.string().min(1),
  postId: z.string().optional(),
  body: z.string().min(1, "댓글 내용을 입력하세요").max(1000),
  type: z.enum(["GENERAL", "INSTRUCTION", "QUESTION", "ANSWER"]).default("GENERAL"),
  parentId: z.string().optional(),
});

export const PinCommentSchema = z.object({
  pinned: z.boolean(),
});

// ─── Review ──────────────────────────────────────────────────────────────────

export const ReviewPostSchema = z.object({
  postId: z.string().min(1),
  studioId: z.string().min(1),
  reviewResult: z.enum(["OK", "NG"]),
  reviewComment: z.string().max(500).optional(),
});

export const SubmitPostSchema = z.object({
  postId: z.string().min(1),
});

// ─── Goal ────────────────────────────────────────────────────────────────────

export const GetGoalSchema = z.object({
  weekStart: WeekStartSchema,
  studentId: z.string().optional(),
});

export const UpsertGoalSchema = z.object({
  studioId: z.string().min(1),
  studentId: z.string().optional(),
  weekTargetCount: z.number().int().min(1).max(7),
  basis: z.enum(["SUBMISSION", "POST"]).default("SUBMISSION"),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type GetThreadInput = z.infer<typeof GetThreadSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type PresignInput = z.infer<typeof PresignSchema>;
export type CompleteRecordingInput = z.infer<typeof CompleteRecordingSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type ReviewPostInput = z.infer<typeof ReviewPostSchema>;
export type UpsertGoalInput = z.infer<typeof UpsertGoalSchema>;
