// src/lib/validators/user.ts
import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]).optional(),
});

export const UserQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  academyId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const CreateInviteSchema = z.object({
  role: z.enum(["ADMIN", "TEACHER"]),
  academyId: z.string().uuid().optional(), // SUPER_ADMIN can specify; ADMIN uses own
});
