/**
 * POST /api/payments/toss/billing/issue
 *
 * Exchange authKey → billingKey after Toss redirect.
 * Can be called by ADMIN (on behalf of student) or STUDENT (self-service).
 * Upserts a PaymentMethod record.
 */
import { NextRequest } from "next/server";
import { guardRoute, parseBody, ok, err } from "@/lib/guards/route-guard";
import { issuePaymentMethodSchema } from "@/lib/validators/billing";
import { issueBillingKey } from "@/lib/toss/billing";
import { writeAuditLog } from "@/lib/services/audit.service";

export async function POST(req: NextRequest) {
  const ctx = await guardRoute(req, ["ADMIN", "STUDENT"]);
  if (ctx instanceof Response) return ctx;

  const body = await parseBody(req, issuePaymentMethodSchema);
  if (body instanceof Response) return body;

  // Determine which studentUserId to use
  let studentUserId: string;
  if (ctx.user.role === "STUDENT") {
    studentUserId = ctx.user.sub;
  } else {
    // ADMIN must provide studentUserId
    if (!body.studentUserId) return err("studentUserId is required for ADMIN", 422);
    // Verify student belongs to this academy
    const student = await ctx.rawDb.user.findFirst({
      where: { id: body.studentUserId, academyId: ctx.academyId!, role: "STUDENT" },
    });
    if (!student) return err("Student not found in this academy", 404);
    studentUserId = body.studentUserId;
  }

  // customerKey must match what was used in the auth flow
  const customerKey = body.customerKey;

  let billingKeyData;
  try {
    billingKeyData = await issueBillingKey(body.authKey, customerKey);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Toss billing key issuance failed";
    return err(msg, 502);
  }

  // Extract last4 from masked card number (e.g. "43XX-XXXX-XXXX-3456" → "3456")
  const masked = billingKeyData.cardNumber ?? "";
  const last4  = masked.replace(/[^0-9]/g, "").slice(-4) || null;

  // Upsert: one active PaymentMethod per student
  await ctx.rawDb.paymentMethod.updateMany({
    where:  { studentUserId, academyId: ctx.academyId!, status: "ACTIVE" },
    data:   { status: "REVOKED" },
  });

  const pm = await ctx.rawDb.paymentMethod.create({
    data: {
      academyId:    ctx.academyId!,
      studentUserId,
      provider:     "TOSS_PAYMENTS",
      customerKey,
      billingKey:   billingKeyData.billingKey,
      status:       "ACTIVE",
      last4,
      cardBrand:    billingKeyData.cardCompany ?? null,
    },
  });

  await writeAuditLog({
    actorUserId: ctx.user.sub,
    academyId:   ctx.academyId,
    action:      "paymentMethod.issue",
    targetType:  "PaymentMethod",
    targetId:    pm.id,
    metaJson:    { studentUserId, provider: "TOSS_PAYMENTS", last4 },
  });

  return ok({
    id:        pm.id,
    last4:     pm.last4,
    cardBrand: pm.cardBrand,
    status:    pm.status,
  }, 201);
}
