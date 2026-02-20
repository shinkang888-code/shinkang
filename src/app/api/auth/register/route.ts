import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";
import bcrypt from "bcryptjs";

const registerSchema = z.object({
  name: z.string().min(2, "이름은 2자 이상입니다."),
  email: z.string().email("유효한 이메일을 입력하세요."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상입니다.")
    .regex(/[A-Z]/, "대문자를 포함해야 합니다.")
    .regex(/[0-9]/, "숫자를 포함해야 합니다."),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "STUDENT"]).default("ADMIN"),
  // ADMIN일 경우 학원 생성
  studioName: z.string().optional(),
});

// POST /api/auth/register
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

  const { name, email, password, phone, role, studioName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return apiError("이미 사용 중인 이메일입니다.", 409);

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { name, email, password: hashed, phone, role },
    });

    // 관리자 등록 시 학원 자동 생성
    if (role === "ADMIN" && studioName) {
      await tx.studio.create({
        data: {
          name: studioName,
          adminId: newUser.id,
        },
      });
    }

    return newUser;
  });

  return apiSuccess(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    201
  );
}
