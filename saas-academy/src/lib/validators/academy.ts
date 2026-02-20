// src/lib/validators/academy.ts
import { z } from "zod";

export const CreateAcademySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z
    .string()
    .min(3, "Code min 3 chars")
    .max(20, "Code max 20 chars")
    .regex(/^[a-z0-9-]+$/, "Code must be lowercase alphanumeric + hyphens"),
});

export const UpdateAcademySchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export const AcademyQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});
