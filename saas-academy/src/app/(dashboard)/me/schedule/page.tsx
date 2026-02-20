"use client";
/**
 * /me/schedule
 * Student: view upcoming and past class sessions with attendance status.
 */
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface Session {
  id:          string;
  localDate:   string;
  startsAt:    string;
  endsAt:      string;
  status:      string;
  class:       { id: string; name: string };
  myAttendance: { status: string; memo: string | null; markedAt: string } | null;
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

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [month,    setMonth]    = useState("");

  async function load(m?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (m) params.set("month", m);
      const res  = await fetch(`/api/me/sessions?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setSessions(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const now = new Date();
  const upcoming = sessions.filter((s) => new Date(s.startsAt) >= now);
  const past     = sessions.filter((s) => new Date(s.startsAt) < now);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); load(e.target.value || undefined); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {month && (
            <button
              onClick={() => { setMonth(""); load(); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >Clear</button>
          )}
        </div>
      </div>

      {error   && <p className="text-red-600">{error}</p>}
      {loading && <div className="flex justify-center py-12"><Spinner /></div>}

      {!loading && (
        <>
          {/* Upcoming */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Upcoming ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-gray-400 text-sm">No upcoming sessions.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div>
                      <p className="font-semibold text-gray-900">{s.class.name}</p>
                      <p className="text-sm text-gray-500">
                        {s.localDate} &nbsp;·&nbsp;
                        {new Date(s.startsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                        {" ~ "}
                        {new Date(s.endsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                      </p>
                    </div>
                    <Badge variant={s.status === "SCHEDULED" ? "default" : s.status === "COMPLETED" ? "active" : "suspended"}>
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Past Sessions ({past.length})
            </h2>
            {past.length === 0 ? (
              <p className="text-gray-400 text-sm">No past sessions.</p>
            ) : (
              <div className="space-y-3">
                {[...past].reverse().map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div>
                      <p className="font-semibold text-gray-900">{s.class.name}</p>
                      <p className="text-sm text-gray-500">
                        {s.localDate} &nbsp;·&nbsp;
                        {new Date(s.startsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.myAttendance ? (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{attIcon[s.myAttendance.status] ?? "?"}</span>
                          <Badge variant={attBadge[s.myAttendance.status] ?? "default"}>
                            {s.myAttendance.status}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
