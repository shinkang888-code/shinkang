/**
 * GET /api/me/subscription – student's most recent active subscription
 */
import { NextRequest } from "next/server";
import { guardRoute, ok } from "@/lib/guards/route-guard";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["STUDENT"]);
  if (ctx instanceof Response) return ctx;

  const sub = await ctx.rawDb.studentSubscription.findFirst({
    where:   { studentUserId: ctx.user.sub, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { name: true, amount: true } } },
  });

  return ok(sub ?? null);
}
