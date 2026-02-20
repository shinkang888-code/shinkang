"use client";
/**
 * /teacher/classes/[id]
 * Teacher: view class sessions and mark attendance.
 * Re-uses the same API as the admin page (TEACHER role filtering is server-side).
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface SessionItem {
  id:        string;
  localDate: string;
  startsAt:  string;
  endsAt:    string;
  status:    string;
  _count:    { attendances: number };
}

interface AttEntry {
  student:    { id: string; name: string; email: string };
  attendance: { id: string; status: string; memo: string | null } | null;
}

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
type AttStatus = typeof STATUSES[number];

const statusColor: Record<AttStatus, string> = {
  PRESENT: "bg-green-500 text-white",
  ABSENT:  "bg-red-500 text-white",
  LATE:    "bg-yellow-500 text-white",
  EXCUSED: "bg-blue-500 text-white",
};

const statusIcon: Record<AttStatus, string> = {
  PRESENT: "✓",
  ABSENT:  "✗",
  LATE:    "⏰",
  EXCUSED: "E",
};

export default function TeacherClassDetailPage() {
  const { id: classId } = useParams<{ id: string }>();
  const router = useRouter();

  const [sessions,  setSessions]  = useState<SessionItem[]>([]);
  const [clsName,   setClsName]   = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const [activeSession,    setActiveSession]    = useState<SessionItem | null>(null);
  const [attEntries,       setAttEntries]       = useState<AttEntry[]>([]);
  const [attLoading,       setAttLoading]       = useState(false);
  const [draftStatuses,    setDraftStatuses]    = useState<Record<string, AttStatus>>({});
  const [draftMemos,       setDraftMemos]       = useState<Record<string, string>>({});
  const [saving,           setSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clsRes, sessRes] = await Promise.all([
        fetch(`/api/academy/classes/${classId}`),
        fetch(`/api/academy/sessions?classId=${classId}&limit=100`),
      ]);
      const [clsJson, sessJson] = await Promise.all([clsRes.json(), sessRes.json()]);
      if (!clsRes.ok) throw new Error(clsJson.error ?? "Failed to load class");
      setClsName(clsJson.data?.name ?? "");
      setSessions(sessJson.data?.sessions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  async function openAttendance(session: SessionItem) {
    setActiveSession(session);
    setAttLoading(true);
    setDraftStatuses({});
    setDraftMemos({});
    try {
      const res  = await fetch(`/api/academy/sessions/${session.id}/attendance`);
      const json = await res.json();
      const entries: AttEntry[] = json.data?.entries ?? [];
      setAttEntries(entries);
      const draftS: Record<string, AttStatus> = {};
      const draftM: Record<string, string>    = {};
      for (const e of entries) {
        if (e.attendance) {
          draftS[e.student.id] = e.attendance.status as AttStatus;
          draftM[e.student.id] = e.attendance.memo ?? "";
        }
      }
      setDraftStatuses(draftS);
      setDraftMemos(draftM);
    } finally {
      setAttLoading(false);
    }
  }

  async function markAll(status: AttStatus) {
    const draft: Record<string, AttStatus> = {};
    for (const e of attEntries) draft[e.student.id] = status;
    setDraftStatuses(draft);
  }

  async function saveAttendance() {
    if (!activeSession) return;
    const entries = attEntries
      .filter((e) => draftStatuses[e.student.id])
      .map((e) => ({
        studentUserId: e.student.id,
        status:        draftStatuses[e.student.id],
        memo:          draftMemos[e.student.id] || null,
      }));
    if (entries.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/academy/sessions/${activeSession.id}/attendance`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setActiveSession(null);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (error)   return <p className="text-red-600">{error}</p>;

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const upcoming  = sessions.filter((s) => s.localDate >= today && s.status === "SCHEDULED");
  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const rest      = sessions.filter((s) => s.status !== "SCHEDULED" && s.status !== "COMPLETED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{clsName}</h1>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
      </div>

      {/* Today / Upcoming */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-4">Upcoming Sessions ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-gray-400 text-sm">No upcoming sessions.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.slice(0, 10).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 border border-gray-100 rounded-lg">
                <div>
                  <span className="font-medium text-gray-900">
                    {s.localDate === today ? "🔴 Today – " : ""}{s.localDate}
                  </span>
                  <span className="ml-3 text-sm text-gray-500">
                    {new Date(s.startsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                  </span>
                </div>
                <Button size="sm" onClick={() => openAttendance(s)}>Mark Attendance</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Completed */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-4">Completed Sessions ({completed.length})</h2>
        {completed.length === 0 ? (
          <p className="text-gray-400 text-sm">No completed sessions.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {[...completed].reverse().map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 border border-gray-100 rounded-lg">
                <div>
                  <span className="font-medium text-gray-700">{s.localDate}</span>
                  <span className="ml-3 text-xs text-gray-400">{s._count.attendances} marked</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="active">COMPLETED</Badge>
                  <Button size="sm" variant="secondary" onClick={() => openAttendance(s)}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Attendance Modal */}
      {activeSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Mark Attendance — {activeSession.localDate}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date(activeSession.startsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                {" ~ "}
                {new Date(activeSession.endsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
              </p>

              {/* Bulk mark buttons */}
              {!attLoading && attEntries.length > 0 && (
                <div className="flex gap-2 mt-3">
                  <span className="text-xs text-gray-500 self-center">Mark all:</span>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => markAll(s)}
                      className={`px-2 py-1 rounded text-xs font-medium ${statusColor[s]}`}
                    >
                      {statusIcon[s]} {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {attLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : attEntries.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No enrolled students.</p>
              ) : (
                attEntries.map((e) => (
                  <div key={e.student.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{e.student.name}</span>
                      <div className="flex gap-1">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() => setDraftStatuses((prev) => ({ ...prev, [e.student.id]: s }))}
                            className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                              draftStatuses[e.student.id] === s
                                ? statusColor[s]
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                            title={s}
                          >
                            {statusIcon[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={draftMemos[e.student.id] ?? ""}
                      onChange={(ev) => setDraftMemos((prev) => ({ ...prev, [e.student.id]: ev.target.value }))}
                      placeholder="Memo (optional)"
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setActiveSession(null)}>Cancel</Button>
              <Button loading={saving} onClick={saveAttendance}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
