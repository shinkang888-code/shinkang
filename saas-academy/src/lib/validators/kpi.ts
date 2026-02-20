/**
 * src/lib/validators/kpi.ts
 *
 * Zod validators for KPI query parameters.
 */
import { z } from "zod";
import { currentMonthKST } from "@/lib/kpi/date-utils";

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function ymdSchema(name: string) {
  return z
    .string()
    .regex(YMD_REGEX, `${name} must be in YYYY-MM-DD format`)
    .refine((s) => {
      const d = new Date(s);
      return !isNaN(d.getTime());
    }, `${name} is not a valid date`);
}

/** Returns default { from, to } = current month KST */
function defaultRange() {
  return currentMonthKST();
}

export const KpiRangeSchema = z.object({
  from:   ymdSchema("from").optional(),
  to:     ymdSchema("to").optional(),
}).transform((v) => {
  const { from: defFrom, to: defTo } = defaultRange();
  const from = v.from ?? defFrom;
  const to   = v.to   ?? defTo;
  if (from > to) {
    throw new Error("`from` must not be after `to`");
  }
  return { from, to };
});

export const KpiTimeseriesSchema = KpiRangeSchema.and(
  z.object({
    bucket: z.enum(["day", "week"]).optional().default("day"),
  }),
).transform((v) => v);

export type KpiRangeParams      = z.infer<typeof KpiRangeSchema>;
export type KpiTimeseriesParams = z.infer<typeof KpiTimeseriesSchema>;

/** Consistent error shape for KPI routes */
export function kpiErrorBody(
  code:     string,
  message:  string,
  details?: unknown,
) {
  return { error: { code, message, details } };
}
