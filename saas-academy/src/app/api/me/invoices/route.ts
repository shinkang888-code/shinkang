/**
 * GET /api/me/invoices  – student views own invoices
 */
import { NextRequest } from "next/server";
import { guardRoute, ok } from "@/lib/guards/route-guard";
import { invoiceQuerySchema } from "@/lib/validators/billing";

export async function GET(req: NextRequest) {
  const ctx = await guardRoute(req, ["STUDENT"]);
  if (ctx instanceof Response) return ctx;

  const url    = new URL(req.url);
  const parsed = invoiceQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  const q      = parsed.success ? parsed.data : { page: 1, limit: 20 };

  const where: Record<string, unknown> = { studentUserId: ctx.user.sub };
  if (q.status) where.status = q.status;

  const [items, total] = await ctx.rawDb.$transaction([
    ctx.rawDb.invoice.findMany({
      where,
      skip:    (q.page - 1) * q.limit,
      take:    q.limit,
      orderBy: { dueDate: "desc" },
      include: {
        plan:     { select: { name: true, amount: true } },
        attempts: { orderBy: { attemptNo: "asc" }, select: { attemptNo: true, status: true, requestedAt: true } },
      },
    }),
    ctx.rawDb.invoice.count({ where }),
  ]);

  return ok({ items, total, page: q.page, limit: q.limit });
}
