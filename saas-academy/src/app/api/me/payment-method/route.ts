/**
 * GET /api/me/payment-method – student's active payment method
 */
import { NextRequest } from "next/server";
import { guardRoute, ok } from "@/lib/guards/route-guard";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["STUDENT"]);
  if (ctx instanceof Response) return ctx;

  const pm = await ctx.rawDb.paymentMethod.findFirst({
    where:   { studentUserId: ctx.user.sub, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, last4: true, cardBrand: true, status: true },
  });

  return ok(pm ?? null);
}
