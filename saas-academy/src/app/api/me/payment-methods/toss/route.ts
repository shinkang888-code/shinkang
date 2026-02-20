/**
 * POST /api/me/payment-methods/toss/init   – student initiates Toss billing auth
 */
import { NextRequest } from "next/server";
import { guardRoute, parseBody, ok } from "@/lib/guards/route-guard";
import { initPaymentMethodSchema } from "@/lib/validators/billing";
import { createBillingAuthParams } from "@/lib/toss/billing";

export async function POST(req: NextRequest) {
  const ctx = await guardRoute(req, ["STUDENT"]);
  if (ctx instanceof Response) return ctx;

  const body = await parseBody(req, initPaymentMethodSchema);
  if (body instanceof Response) return body;

  const customerKey = ctx.user.sub; // stable per student

  const authParams = createBillingAuthParams({
    customerKey,
    successUrl: body.successUrl,
    failUrl:    body.failUrl,
  });

  return ok({
    clientKey:   process.env.TOSS_PAYMENTS_CLIENT_KEY ?? "",
    customerKey: authParams.customerKey,
    successUrl:  authParams.successUrl,
    failUrl:     authParams.failUrl,
  });
}
