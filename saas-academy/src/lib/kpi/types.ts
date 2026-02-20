/**
 * src/lib/kpi/types.ts
 *
 * Shared TypeScript types for KPI API responses.
 * Used by both server queries and client UI.
 */

export interface TimePoint {
  date:  string; // "YYYY-MM-DD"
  value: number;
}

// ── Summary response ──────────────────────────────────────────────────────────

export interface RevenueKPI {
  totalPaidAmount:   number;
  paidCount:         number;
  outstandingAmount: number;
  outstandingCount:  number;
  failedCount:       number;
  collectionRate:    number;
}

export interface StudentKPI {
  activeCount:      number;
  newCount:         number;
  churnCount:       number;
  participantCount: number;
}

export interface AttendanceSummaryKPI {
  scheduledSessions: number;
  completedSessions: number;
  attendanceRate:    number;
  lateRate:          number;
}

export interface TeacherSummaryKPI {
  activeCount: number;
}

export interface RiskKPI {
  atRiskStudentsCount:     number;
  delinquentStudentsCount: number;
}

export interface NotifKPI {
  queuedCount: number;
  failedCount: number;
}

export interface KpiSummaryResponse {
  range:         { from: string; to: string };
  revenue:       RevenueKPI;
  students:      StudentKPI;
  attendance:    AttendanceSummaryKPI;
  teachers:      TeacherSummaryKPI;
  risk:          RiskKPI;
  notifications: NotifKPI;
}

// ── Timeseries response ───────────────────────────────────────────────────────

export interface KpiTimeseriesResponse {
  range:  { from: string; to: string };
  bucket: "day" | "week";
  series: {
    revenuePaidAmount: TimePoint[];
    attendanceRate:    TimePoint[];
    newStudents:       TimePoint[];
  };
}

// ── Toplists response ────────────────────────────────────────────────────────

export interface TeacherSessionRow {
  teacherId:   string;
  teacherName: string;
  sessions:    number;
}

export interface TeacherAttendanceRow {
  teacherId:      string;
  teacherName:    string;
  attendanceRate: number;
  totalSessions:  number;
}

export interface AtRiskStudent {
  studentId:       string;
  name:            string;
  absentCount30d:  number;
  lastSessionDate: string | null;
}

export interface DelinquentStudent {
  studentId:      string;
  name:           string;
  overdueAmount:  number;
  overdueDaysMax: number;
}

export interface KpiToplistsResponse {
  range:                       { from: string; to: string };
  topTeachersBySessions:       TeacherSessionRow[];
  topTeachersByAttendanceRate: TeacherAttendanceRow[];
  atRiskStudents:              AtRiskStudent[];
  delinquentStudents:          DelinquentStudent[];
}
