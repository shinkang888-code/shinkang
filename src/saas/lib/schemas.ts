import { z } from "zod";

// ─── Auth schemas ────────────────────────────────────────────────

export const RegisterSchema = z.object({
  academyCode: z.string().min(2).max(20),
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter and one number"
    ),
  role: z.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
  /** invitation token — required for TEACHER unless ADMIN creates directly */
  inviteToken: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Academy schemas ─────────────────────────────────────────────

export const CreateAcademySchema = z.object({
  name: z.string().min(2).max(100),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-z0-9-]+$/, "Code must be lowercase alphanumeric with dashes"),
});

export const UpdateAcademySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
});

export const AcademyQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── User schemas ────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[A-Z])(?=.*\d)/),
  role: z.enum(["TEACHER", "STUDENT"]),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  role: z.enum(["TEACHER", "STUDENT"]).optional(),
});

export const UpdateUserSuperAdminSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"]).optional(),
});

export const UserQuerySchema = z.object({
  search: z.string().optional(),
  role: z
    .enum(["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"])
    .optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  academyId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
