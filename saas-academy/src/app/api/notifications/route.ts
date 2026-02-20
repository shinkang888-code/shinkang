/**
 * POST /api/notifications/send
 *
 * Manually trigger a notification.
 * Requires: ADMIN (own academy) or SUPER_ADMIN.
 *
 * Body:
 *   { phone, templateCode, params, recipientId? }
 *
 * POST /api/notifications/retry  (internal / cron)
 *   Processes retries; only SUPER_ADMIN or internal cron token.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/guards/require-role";
import { enqueueNotification, processRetries } from "@/lib/services/notification.service";
import { writeAuditLog } from "@/lib/services/audit.service";

const sendSchema = z.object({
  phone:        z.string().min(9).max(15),
  templateCode: z.string().min(1),
  params:       z.record(z.string()),
  recipientId:  z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  // Only ADMIN or SUPER_ADMIN may trigger manual notifications
  const auth = await requireRole(req, ["ADMIN", "SUPER_ADMIN"]);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { phone, templateCode, params, recipientId } = parsed.data;

  // ADMIN must supply academyId from their own token; SUPER_ADMIN can supply any
  const academyId = user.academyId;
  if (!academyId) {
    return NextResponse.json(
      { error: "academyId is required" },
      { status: 400 },
    );
  }

  const result = await enqueueNotification({
    academyId,
    recipientId,
    phone,
    templateCode,
    params,
  });

  // Audit
  await writeAuditLog({
    actorUserId: user.id,
    academyId,
    action:      "notification.send",
    targetType:  "Notification",
    metaJson:    { phone, templateCode, success: result?.success },
    ip:          req.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ success: result?.success, error: result?.error });
}

/** GET /api/notifications/retry — sweep pending notifications */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["SUPER_ADMIN"]);
  if (auth.error) return auth.error;

  const result = await processRetries();
  return NextResponse.json(result);
}
