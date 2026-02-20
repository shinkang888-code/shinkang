/**
 * GET /api/saas/auth/me
 * Returns current user info from access token
 */
import { NextRequest } from "next/server";
import { requireSaasAuth, saasOk } from "@/saas/guards";
import { saasPrisma } from "@/saas/lib/prisma";

export async function GET(req: NextRequest) {
  const result = await requireSaasAuth(req);
  if ("error" in result) return result.error;

  const user = await saasPrisma.saasUser.findUnique({
    where: { id: result.user.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      academyId: true,
      createdAt: true,
      academy: { select: { id: true, name: true, code: true, status: true } },
    },
  });

  if (!user) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  return saasOk({ user });
}
