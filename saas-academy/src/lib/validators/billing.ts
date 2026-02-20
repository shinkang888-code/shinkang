/**
 * src/lib/validators/billing.ts
 * Zod schemas for billing-related API bodies.
 */
import { z } from "zod";

// ─── Tuition Plan ─────────────────────────────────────────────────────────────

export const createTuitionPlanSchema = z.object({
  name:        z.string().min(1).max(100),
  amount:      z.number().int().positive(),
  currency:    z.string().default("KRW"),
  billingDay:  z.number().int().min(1).max(28),
  graceDays:   z.number().int().min(0).max(30).default(3),
  lateFee:     z.number().int().min(0).optional(),
  isActive:    z.boolean().default(true),
});

export const updateTuitionPlanSchema = createTuitionPlanSchema.partial();

export type CreateTuitionPlanInput = z.infer<typeof createTuitionPlanSchema>;
export type UpdateTuitionPlanInput = z.infer<typeof updateTuitionPlanSchema>;

// ─── Student Subscription ─────────────────────────────────────────────────────

export const createSubscriptionSchema = z.object({
  studentUserId: z.string().uuid(),
  planId:        z.string().uuid(),
  startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const updateSubscriptionSchema = z.object({
  status:          z.enum(["ACTIVE", "PAUSED", "CANCELED"]).optional(),
  nextBillingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

// ─── Payment Method (Toss) ────────────────────────────────────────────────────

/** Sent by admin to initiate Toss billing auth for a student */
export const initPaymentMethodSchema = z.object({
  successUrl: z.string().url(),
  failUrl:    z.string().url(),
});

/** Sent to exchange authKey → billingKey */
export const issuePaymentMethodSchema = z.object({
  authKey:       z.string().min(1),
  customerKey:   z.string().min(1),
  studentUserId: z.string().uuid().optional(), // admin path only
});

export type InitPaymentMethodInput    = z.infer<typeof initPaymentMethodSchema>;
export type IssuePaymentMethodInput   = z.infer<typeof issuePaymentMethodSchema>;

// ─── Invoice ──────────────────────────────────────────────────────────────────

export const invoiceQuerySchema = z.object({
  page:           z.coerce.number().int().min(1).default(1),
  limit:          z.coerce.number().int().min(1).max(100).default(20),
  status:         z.enum(["PENDING","PAID","FAILED","CANCELED"]).optional(),
  subscriptionId: z.string().uuid().optional(),
  studentUserId:  z.string().uuid().optional(),
});

export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
