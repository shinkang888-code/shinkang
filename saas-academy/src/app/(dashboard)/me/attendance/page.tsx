"use client";
/**
 * /me/attendance
 * Student: view own attendance history with summary stats.
 */
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface AttRecord {
  id:        string;
  status:    string;
  memo:      string | null;
  markedAt:  string | null;
  session:   { localDate: string; startsAt: string };
  class:     { name: string };
}

interface SummaryItem {
  status: string;
  _count: { _all: number };
}

const attBadge: Record<string, "active" | "suspended" | "default"> = {
  PRESENT: "active",
  ABSENT:  "suspended",
  LATE:    "default",
  EXCUSED: "default",
};

const attIcon: Record<string, string> = {
  PRESENT: "✅",
  ABSENT:  "❌",
  LATE:    "⏰",
  EXCUSED: "📋",
};

export default function AttendancePage() {
  const [records, setRecords]   = useState<AttRecord[]>([]);
  const [summary, setSummary]   = useState<SummaryItem[]>([]);
  const [total,   setTotal]     = useState(0);
  const [page,    setPage]      = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");
  const [month,   setMonth]     = useState("");
  const LIMIT = 20;

  async function load(p = 1, m?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (m) params.set("month", m);
      const res  = await fetch(`/api/me/attendance?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRecords(json.data.records ?? []);
      setSummary(json.data.summary ?? []);
      setTotal(json.data.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, []);

  const summaryMap = Object.fromEntries(summary.map((s) => [s.status, s._count._all]));
  const totalCount = summary.reduce((acc, s) => acc + s._count._all, 0);
  const presentCount = (summaryMap["PRESENT"] ?? 0) + (summaryMap["LATE"] ?? 0);
  const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => { const m = e.target.value; setMonth(m); setPage(1); load(1, m || undefined); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {month && (
            <button onClick={() => { setMonth(""); setPage(1); load(1); }} className="text-sm text-gray-500 hover:text-gray-700">
              Clear
            </button>
          )}
        </div>
      </div>

      {error   && <p className="text-red-600">{error}</p>}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 mb-1">Attendance Rate</p>
          <p className="text-3xl font-bold text-brand-600">{rate}%</p>
        </div>
        {["PRESENT", "ABSENT", "LATE", "EXCUSED"].map((s) => (
          <div key={s} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xl mb-1">{attIcon[s]}</p>
            <p className="text-2xl font-bold text-gray-900">{summaryMap[s] ?? 0}</p>
            <p className="text-xs text-gray-500">{s}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">📋</p>
          <p>No attendance records yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Class</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Memo</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{r.session.localDate}</td>
                  <td className="px-4 py-3 text-gray-700">{r.class.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{attIcon[r.status]}</span>
                      <Badge variant={attBadge[r.status] ?? "default"}>{r.status}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.memo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">{total} total records</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); load(p, month || undefined); }}
                  className="px-3 py-1 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1 text-sm text-gray-600">
                  Page {page} / {Math.ceil(total / LIMIT)}
                </span>
                <button
                  disabled={page >= Math.ceil(total / LIMIT)}
                  onClick={() => { const p = page + 1; setPage(p); load(p, month || undefined); }}
                  className="px-3 py-1 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
