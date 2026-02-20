/**
 * src/lib/validators/auth.ts
 * Zod schemas for all auth and admin endpoints.
 */
import { z } from "zod";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit");

export const registerSchema = z.object({
  name:        z.string().min(2).max(80),
  email:       z.string().email(),
  password,
  // Exactly one of academyCode (public STUDENT signup) or inviteToken must be supplied
  academyCode: z.string().min(1).optional(),
  inviteToken: z.string().min(1).optional(),
}).refine(
  (d) => !!(d.academyCode ?? d.inviteToken),
  { message: "Either academyCode or inviteToken is required" },
);

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  // refresh token may come from body (fallback) – primary source is httpOnly cookie
  refreshToken: z.string().optional(),
});

export const createInviteSchema = z.object({
  role:      z.enum(["ADMIN", "TEACHER"]),
  expiresIn: z.number().int().positive().optional().default(48), // hours
  // Only SUPER_ADMIN may set academyId directly; ADMIN uses their own
  academyId: z.string().uuid().optional(),
});

// ─── Academy schemas (SUPER_ADMIN) ───────────────────────────────────────────

export const CreateAcademySchema = z.object({
  name:   z.string().min(2).max(120),
  code:   z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/, "Code must be alphanumeric/dash/underscore"),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional().default("ACTIVE"),
});

export const PatchAcademySchema = z.object({
  name:   z.string().min(2).max(120).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

// ─── User schemas (ADMIN / SUPER_ADMIN) ──────────────────────────────────────

export const CreateUserSchema = z.object({
  name:     z.string().min(2).max(80),
  email:    z.string().email(),
  password,
  role:     z.enum(["ADMIN", "TEACHER", "STUDENT"]),
});

export const PatchUserSchema = z.object({
  name:   z.string().min(2).max(80).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  role:   z.enum(["ADMIN", "TEACHER", "STUDENT"]).optional(),
});

// ─── Legacy aliases ───────────────────────────────────────────────────────────
export { createInviteSchema as CreateInviteSchema };
export { loginSchema as LoginSchema };
