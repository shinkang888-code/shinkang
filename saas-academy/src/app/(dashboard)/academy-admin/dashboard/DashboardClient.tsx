"use client";
/**
 * src/app/(dashboard)/academy-admin/dashboard/DashboardClient.tsx
 *
 * Client component: interactive KPI dashboard.
 * Receives initial data from server component; re-fetches on date range change.
 *
 * Layout:
 *   1. Header + DateRangePicker
 *   2. Revenue KPI cards (4 cards)
 *   3. Student & Attendance KPI cards (4 cards)
 *   4. Trend charts (revenue + attendance rate)
 *   5. Tables: top teachers, at-risk students, delinquent students
 */

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { KpiCard }         from "@/components/kpi/KpiCard";
import { TrendChart }      from "@/components/kpi/TrendChart";
import { DateRangePicker } from "@/components/kpi/DateRangePicker";
import type {
  KpiSummaryResponse,
  KpiTimeseriesResponse,
  KpiToplistsResponse,
} from "@/lib/kpi/types";
import { currentMonthKST } from "@/lib/kpi/date-utils";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000)      return `${(n / 10_000).toFixed(0)}만원`;
  return `${n.toLocaleString()}원`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialSummary:    KpiSummaryResponse;
  initialTimeseries: KpiTimeseriesResponse;
  initialToplists:   KpiToplistsResponse;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardClient({
  initialSummary,
  initialTimeseries,
  initialToplists,
}: Props) {
  const defaultRange = currentMonthKST();

  const [range,      setRange]      = useState(defaultRange);
  const [bucket,     setBucket]     = useState<"day" | "week">("day");
  const [summary,    setSummary]    = useState(initialSummary);
  const [timeseries, setTimeseries] = useState(initialTimeseries);
  const [toplists,   setToplists]   = useState(initialToplists);
  const [isPending,  startTransition] = useTransition();

  const fetchAll = useCallback(
    (from: string, to: string, bkt: "day" | "week") => {
      startTransition(async () => {
        const qs = `from=${from}&to=${to}`;
        const [sRes, tRes, lRes] = await Promise.all([
          fetch(`/api/academy/kpi/summary?${qs}`),
          fetch(`/api/academy/kpi/timeseries?${qs}&bucket=${bkt}`),
          fetch(`/api/academy/kpi/toplists?${qs}`),
        ]);
        if (sRes.ok) setSummary(await sRes.json());
        if (tRes.ok) setTimeseries(await tRes.json());
        if (lRes.ok) setToplists(await lRes.json());
      });
    },
    [],
  );

  // Re-fetch when range or bucket changes
  useEffect(() => {
    fetchAll(range.from, range.to, bucket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, bucket]);

  const loading = isPending;
  const { revenue, students, attendance, teachers, risk, notifications } = summary;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">원장 대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            학원 운영 핵심 지표 · KST 기준
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            value={range}
            onChange={(r) => setRange(r)}
          />
          {/* Bucket toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(["day", "week"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  bucket === b
                    ? "bg-brand-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {b === "day" ? "일별" : "주별"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Revenue cards ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          수납 현황
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="납부 완료"
            value={fmtKRW(revenue.totalPaidAmount)}
            subLabel="건수"
            subValue={`${revenue.paidCount}건`}
            icon="💰"
            color="green"
            loading={loading}
          />
          <KpiCard
            label="수납률"
            value={fmtPct(revenue.collectionRate)}
            subLabel="미납"
            subValue={fmtKRW(revenue.outstandingAmount)}
            icon="📈"
            color="blue"
            loading={loading}
          />
          <KpiCard
            label="미납 금액"
            value={fmtKRW(revenue.outstandingAmount)}
            subLabel="미납 건수"
            subValue={`${revenue.outstandingCount}건`}
            icon="⏳"
            color="yellow"
            loading={loading}
          />
          <KpiCard
            label="납부 실패"
            value={`${revenue.failedCount}건`}
            icon="❌"
            color="red"
            loading={loading}
          />
        </div>
      </section>

      {/* ── Student & Attendance cards ─────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          학생 · 출결
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="재원생"
            value={`${students.activeCount}명`}
            subLabel="신규"
            subValue={`+${students.newCount}명`}
            icon="👨‍🎓"
            color="blue"
            loading={loading}
          />
          <KpiCard
            label="출석률"
            value={fmtPct(attendance.attendanceRate)}
            subLabel="지각률"
            subValue={fmtPct(attendance.lateRate)}
            icon="✅"
            color="green"
            loading={loading}
          />
          <KpiCard
            label="진행 수업"
            value={`${attendance.scheduledSessions}회`}
            subLabel="완료"
            subValue={`${attendance.completedSessions}회`}
            icon="📅"
            color="purple"
            loading={loading}
          />
          <KpiCard
            label="담당 강사"
            value={`${teachers.activeCount}명`}
            icon="👩‍🏫"
            color="gray"
            loading={loading}
          />
        </div>
      </section>

      {/* ── Risk cards ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          위험 신호
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="결석 위험 학생"
            value={`${risk.atRiskStudentsCount}명`}
            subLabel="30일 내 3회↑"
            subValue=""
            icon="⚠️"
            color={risk.atRiskStudentsCount > 0 ? "red" : "gray"}
            loading={loading}
          />
          <KpiCard
            label="미납 연체 학생"
            value={`${risk.delinquentStudentsCount}명`}
            subLabel="7일 초과"
            subValue=""
            icon="💸"
            color={risk.delinquentStudentsCount > 0 ? "red" : "gray"}
            loading={loading}
          />
          <KpiCard
            label="알림 발송"
            value={`${notifications.queuedCount}건`}
            subLabel="실패"
            subValue={`${notifications.failedCount}건`}
            icon="🔔"
            color={notifications.failedCount > 0 ? "yellow" : "gray"}
            loading={loading}
          />
          <KpiCard
            label="퇴원 (기간 내)"
            value={`${students.churnCount}명`}
            icon="🚪"
            color={students.churnCount > 0 ? "yellow" : "gray"}
            loading={loading}
          />
        </div>
      </section>

      {/* ── Trend charts ───────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {loading ? (
            <div className="h-[220px] animate-pulse bg-gray-50 rounded-lg" />
          ) : (
            <TrendChart
              data={timeseries.series.revenuePaidAmount}
              title="납부 금액 추이"
              color="#22c55e"
              formatValue={(v) => fmtKRW(v)}
              height={220}
            />
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {loading ? (
            <div className="h-[220px] animate-pulse bg-gray-50 rounded-lg" />
          ) : (
            <TrendChart
              data={timeseries.series.attendanceRate}
              title="출석률 추이"
              color="#6366f1"
              isPercent
              height={220}
            />
          )}
        </div>
      </section>

      {/* ── Top teachers ───────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By sessions */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">강사별 수업 횟수 TOP 5</h3>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse bg-gray-50 rounded" />
              ))}
            </div>
          ) : toplists.topTeachersBySessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">데이터 없음</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-5 py-2 text-left font-medium">강사</th>
                  <th className="px-5 py-2 text-right font-medium">수업 횟수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {toplists.topTeachersBySessions.map((t, i) => (
                  <tr key={t.teacherId} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 text-gray-700">
                      <span className="text-gray-400 mr-2">#{i + 1}</span>
                      {t.teacherName}
                    </td>
                    <td className="px-5 py-2.5 text-right font-medium text-gray-900">
                      {t.sessions}회
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* By attendance rate */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">강사별 출석률 TOP 5</h3>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse bg-gray-50 rounded" />
              ))}
            </div>
          ) : toplists.topTeachersByAttendanceRate.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">데이터 없음</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-5 py-2 text-left font-medium">강사</th>
                  <th className="px-5 py-2 text-right font-medium">출석률</th>
                  <th className="px-5 py-2 text-right font-medium">총 출결 수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {toplists.topTeachersByAttendanceRate.map((t, i) => (
                  <tr key={t.teacherId} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 text-gray-700">
                      <span className="text-gray-400 mr-2">#{i + 1}</span>
                      {t.teacherName}
                    </td>
                    <td className="px-5 py-2.5 text-right font-medium text-green-600">
                      {fmtPct(t.attendanceRate)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-gray-500">
                      {t.totalSessions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── At-risk students ────────────────────────────────────────────────── */}
      <section>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">결석 위험 학생 (최근 30일)</h3>
              <p className="text-xs text-gray-400 mt-0.5">결석 3회 이상 학생</p>
            </div>
            {toplists.atRiskStudents.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {toplists.atRiskStudents.length}명
              </span>
            )}
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse bg-gray-50 rounded" />
              ))}
            </div>
          ) : toplists.atRiskStudents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">위험 학생 없음 ✓</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-5 py-2 text-left font-medium">학생</th>
                  <th className="px-5 py-2 text-right font-medium">30일 결석</th>
                  <th className="px-5 py-2 text-right font-medium">최근 수업일</th>
                  <th className="px-5 py-2 text-right font-medium">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {toplists.atRiskStudents.map((s) => (
                  <tr key={s.studentId} className="hover:bg-red-50">
                    <td className="px-5 py-2.5 font-medium text-gray-800">{s.name}</td>
                    <td className="px-5 py-2.5 text-right text-red-600 font-semibold">
                      {s.absentCount30d}회
                    </td>
                    <td className="px-5 py-2.5 text-right text-gray-500">
                      {s.lastSessionDate ?? "-"}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <a
                        href={`/academy-admin/students/${s.studentId}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        보기 →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Delinquent students ─────────────────────────────────────────────── */}
      <section>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">미납 연체 학생</h3>
              <p className="text-xs text-gray-400 mt-0.5">납부 기한 7일 초과</p>
            </div>
            {toplists.delinquentStudents.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {toplists.delinquentStudents.length}명
              </span>
            )}
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse bg-gray-50 rounded" />
              ))}
            </div>
          ) : toplists.delinquentStudents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">연체 학생 없음 ✓</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-5 py-2 text-left font-medium">학생</th>
                  <th className="px-5 py-2 text-right font-medium">연체 금액</th>
                  <th className="px-5 py-2 text-right font-medium">최대 연체일</th>
                  <th className="px-5 py-2 text-right font-medium">알림 / 상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {toplists.delinquentStudents.map((s) => (
                  <tr key={s.studentId} className="hover:bg-orange-50">
                    <td className="px-5 py-2.5 font-medium text-gray-800">{s.name}</td>
                    <td className="px-5 py-2.5 text-right text-orange-600 font-semibold">
                      {fmtKRW(s.overdueAmount)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-gray-500">
                      {s.overdueDaysMax}일
                    </td>
                    <td className="px-5 py-2.5 text-right flex items-center justify-end gap-2">
                      <a
                        href={`/academy-admin/students/${s.studentId}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        보기 →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
