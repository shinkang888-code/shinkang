/**
 * src/lib/validators/notifications.ts
 *
 * Zod schemas for AlimTalk notification-related API bodies.
 */
import { z } from "zod";

// ── Parent Contact ─────────────────────────────────────────────────────────

export const ParentRelationshipEnum = z.enum(["MOTHER", "FATHER", "GUARDIAN", "ETC"]);
export const ContactStatusEnum      = z.enum(["ACTIVE", "INACTIVE"]);

/** Normalize Korean mobile phone: strip dashes/spaces, ensure 010... format */
function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-]/g, "");
}

const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((v) => /^01[016789]\d{7,8}$/.test(v), {
    message: "올바른 휴대폰 번호를 입력하세요 (예: 01012345678)",
  });

export const CreateParentContactSchema = z.object({
  studentUserId:     z.string().uuid(),
  name:              z.string().min(1).max(50),
  phone:             phoneSchema,
  relationship:      ParentRelationshipEnum.default("ETC"),
  notificationOptIn: z.boolean().default(false),
  preferredLanguage: z.string().max(5).default("KO"),
});

export const UpdateParentContactSchema = z.object({
  name:              z.string().min(1).max(50).optional(),
  phone:             phoneSchema.optional(),
  relationship:      ParentRelationshipEnum.optional(),
  notificationOptIn: z.boolean().optional(),
  preferredLanguage: z.string().max(5).optional(),
  status:            ContactStatusEnum.optional(),
  consentRecordedAt: z.string().datetime().nullable().optional(),
});

export type CreateParentContactInput = z.infer<typeof CreateParentContactSchema>;
export type UpdateParentContactInput = z.infer<typeof UpdateParentContactSchema>;

// ── Academy Notification Settings ─────────────────────────────────────────

export const UpsertNotificationSettingsSchema = z.object({
  alimtalkEnabled:           z.boolean().optional(),
  sendOnAbsent:              z.boolean().optional(),
  sendOnLate:                z.boolean().optional(),
  sendOnExcused:             z.boolean().optional(),
  allowResendOnStatusChange: z.boolean().optional(),
  quietHoursEnabled:         z.boolean().optional(),
  quietHoursStart:           z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Format must be HH:mm")
    .optional(),
  quietHoursEnd:             z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Format must be HH:mm")
    .optional(),
});

export type UpsertNotificationSettingsInput = z.infer<
  typeof UpsertNotificationSettingsSchema
>;

// ── AlimTalk Template ──────────────────────────────────────────────────────

export const AlimtalkTemplateTypeEnum = z.enum(["ABSENT", "LATE", "EXCUSED"]);

export const UpsertAlimtalkTemplateSchema = z.object({
  type:         AlimtalkTemplateTypeEnum,
  templateCode: z.string().min(1).max(100),
  senderKey:    z.string().min(1).max(200),
  isActive:     z.boolean().optional().default(true),
});

export type UpsertAlimtalkTemplateInput = z.infer<
  typeof UpsertAlimtalkTemplateSchema
>;
