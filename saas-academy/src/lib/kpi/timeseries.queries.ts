/**
 * src/lib/kpi/timeseries.queries.ts
 *
 * Unified timeseries builder.
 * Calls individual series functions and fills in zero-value buckets
 * so the frontend always receives a complete series for the date range.
 */

import {
  enumerateDays,
  enumerateWeekStarts,
} from "@/lib/kpi/date-utils";
import {
  getRevenueDailyTimeseries,
  getRevenueWeeklyTimeseries,
  type RevenueTimePoint,
} from "@/lib/kpi/revenue.queries";
import {
  getNewStudentsDailyTimeseries,
  getNewStudentsWeeklyTimeseries,
} from "@/lib/kpi/students.queries";
import {
  getAttendanceRateDailyTimeseries,
  getAttendanceRateWeeklyTimeseries,
} from "@/lib/kpi/attendance.queries";

export type Bucket = "day" | "week";

export interface TimePoint {
  date:  string;
  value: number;
}

export interface KpiTimeseries {
  revenuePaidAmount: TimePoint[];
  attendanceRate:    TimePoint[];
  newStudents:       TimePoint[];
}

/**
 * Fetch all three timeseries for the given range and bucket.
 * Zero-fills missing buckets so arrays always have the same length.
 */
export async function getKpiTimeseries(
  academyId: string,
  from: string,
  to:   string,
  bucket: Bucket = "day",
): Promise<KpiTimeseries> {
  const [revenue, newStudents, attendance] =
    bucket === "day"
      ? await Promise.all([
          getRevenueDailyTimeseries(academyId, from, to),
          getNewStudentsDailyTimeseries(academyId, from, to),
          getAttendanceRateDailyTimeseries(academyId, from, to),
        ])
      : await Promise.all([
          getRevenueWeeklyTimeseries(academyId, from, to),
          getNewStudentsWeeklyTimeseries(academyId, from, to),
          getAttendanceRateWeeklyTimeseries(academyId, from, to),
        ]);

  // Build scaffold of all buckets in range
  const buckets =
    bucket === "day"
      ? enumerateDays(from, to)
      : enumerateWeekStarts(from, to);

  return {
    revenuePaidAmount: fillZeros(buckets, revenue),
    attendanceRate:    fillZeros(buckets, attendance),
    newStudents:       fillZeros(buckets, newStudents),
  };
}

// ── Helper: fill zeros for missing buckets ────────────────────────────────────

function fillZeros(buckets: string[], raw: TimePoint[]): TimePoint[] {
  const map = new Map(raw.map((r) => [r.date, r.value]));
  return buckets.map((date) => ({ date, value: map.get(date) ?? 0 }));
}
