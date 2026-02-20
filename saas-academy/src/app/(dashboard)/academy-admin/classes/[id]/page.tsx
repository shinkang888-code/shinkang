"use client";
/**
 * /academy-admin/classes/[id]
 * Class detail: info, enrollments, sessions list, attendance modal.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface ClassDetail {
  id:          string;
  name:        string;
  status:      string;
  startDate:   string;
  endDate:     string | null;
  capacity:    number | null;
  teacher:     { id: string; name: string; email: string } | null;
  schedules:   { daysOfWeek: number[]; startTime: string; durationMin: number }[];
  enrollments: Array<{
    id:        string;
    status:    string;
    student:   { id: string; name: string; email: string };
  }>;
  _count:      { sessions: number; attendances: number };
}

interface Session {
  id:          string;
  localDate:   string;
  startsAt:    string;
  endsAt:      string;
  status:      string;
  _count:      { attendances: number };
}

interface AttendanceEntry {
  enrollment: { id: string; status: string };
  student:    { id: string; name: string; email: string };
  attendance: { id: string; status: string; memo: string | null } | null;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
type AttStatus = typeof STATUSES[number];

const statusBadge: Record<string, "active" | "suspended" | "default"> = {
  PRESENT:   "active",
  ABSENT:    "suspended",
  LATE:      "default",
  EXCUSED:   "default",
  SCHEDULED: "default",
  COMPLETED: "active",
  CANCELED:  "suspended",
};

export default function ClassDetailPage() {
  const { id: classId } = useParams<{ id: string }>();
  const router = useRouter();

  const [cls,       setCls]       = useState<ClassDetail | null>(null);
  const [sessions,  setSessions]  = useState<Session[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // Attendance modal state
  const [activeSession,   setActiveSession]   = useState<Session | null>(null);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [attLoading,      setAttLoading]      = useState(false);
  const [draftStatuses,   setDraftStatuses]   = useState<Record<string, AttStatus>>({});
  const [saving,          setSaving]          = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clsRes, sessRes] = await Promise.all([
        fetch(`/api/academy/classes/${classId}`),
        fetch(`/api/academy/sessions?classId=${classId}&limit=100`),
      ]);
      const [clsJson, sessJson] = await Promise.all([clsRes.json(), sessRes.json()]);
      if (!clsRes.ok) throw new Error(clsJson.error ?? "Failed to load class");
      setCls(clsJson.data);
      setSessions(sessJson.data?.sessions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  async function openAttendance(session: Session) {
    setActiveSession(session);
    setAttLoading(true);
    setDraftStatuses({});
    try {
      const res  = await fetch(`/api/academy/sessions/${session.id}/attendance`);
      const json = await res.json();
      const entries: AttendanceEntry[] = json.data?.entries ?? [];
      setAttendanceEntries(entries);
      // Pre-fill draft from existing attendance
      const draft: Record<string, AttStatus> = {};
      for (const e of entries) {
        if (e.attendance) draft[e.student.id] = e.attendance.status as AttStatus;
      }
      setDraftStatuses(draft);
    } catch {
      // ignore
    } finally {
      setAttLoading(false);
    }
  }

  async function saveAttendance() {
    if (!activeSession) return;
    const entries = attendanceEntries
      .filter((e) => draftStatuses[e.student.id])
      .map((e) => ({ studentUserId: e.student.id, status: draftStatuses[e.student.id] }));
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

  async function enroll(studentId: string) {
    const res = await fetch(`/api/academy/classes/${classId}/enroll`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentUserId: studentId }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error ?? "Failed to enroll"); return; }
    load();
  }

  async function regenerate() {
    if (!confirm("Regenerate future sessions? Sessions with attendance will be preserved.")) return;
    const res = await fetch(`/api/academy/classes/${classId}/regenerate-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeks: 8 }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error ?? "Failed"); return; }
    alert(`Done! Created: ${json.data.created}, Deleted: ${json.data.deleted}, Skipped (has attendance): ${json.data.skippedWithAttendance}`);
    load();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (error)   return <p className="text-red-600">{error}</p>;
  if (!cls)    return <p className="text-gray-500">Class not found.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{cls.name}</h1>
            <Badge variant={cls.status === "ACTIVE" ? "active" : "default"}>{cls.status}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            Teacher: {cls.teacher?.name ?? "—"} &nbsp;·&nbsp;
            {new Date(cls.startDate).toLocaleDateString("ko-KR")}
            {cls.endDate && ` ~ ${new Date(cls.endDate).toLocaleDateString("ko-KR")}`}
            &nbsp;·&nbsp; Capacity: {cls.capacity ?? "∞"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {cls.schedules.map((s, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {s.daysOfWeek.map((d) => DOW[d]).join("/")} {s.startTime} ({s.durationMin}min)
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={regenerate}>Regenerate Sessions</Button>
          <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        </div>
      </div>

      {/* Enrollments */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-4">Enrollments ({cls.enrollments.length})</h2>
        {cls.enrollments.length === 0 ? (
          <p className="text-gray-400 text-sm">No students enrolled.</p>
        ) : (
          <div className="space-y-2">
            {cls.enrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <span className="font-medium text-gray-900">{e.student.name}</span>
                  <span className="ml-2 text-sm text-gray-500">{e.student.email}</span>
                </div>
                <Badge variant={e.status === "ACTIVE" ? "active" : "suspended"}>{e.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sessions */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-4">Sessions ({sessions.length})</h2>
        {sessions.length === 0 ? (
          <p className="text-gray-400 text-sm">No sessions generated.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                <div>
                  <span className="font-medium text-gray-900">{s.localDate}</span>
                  <span className="ml-3 text-sm text-gray-500">
                    {new Date(s.startsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                    {" ~ "}
                    {new Date(s.endsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{s._count.attendances} marked</span>
                  <Badge variant={statusBadge[s.status] ?? "default"}>{s.status}</Badge>
                  {s.status !== "CANCELED" && (
                    <Button size="sm" variant="secondary" onClick={() => openAttendance(s)}>
                      Attendance
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Attendance Modal */}
      {activeSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                Attendance — {activeSession.localDate}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date(activeSession.startsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                {" ~ "}
                {new Date(activeSession.endsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
              </p>
            </div>

            <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
              {attLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : attendanceEntries.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No enrolled students.</p>
              ) : (
                attendanceEntries.map((e) => (
                  <div key={e.student.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{e.student.name}</span>
                    <div className="flex gap-1">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setDraftStatuses((prev) => ({ ...prev, [e.student.id]: s }))}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            draftStatuses[e.student.id] === s
                              ? s === "PRESENT"  ? "bg-green-500 text-white"
                              : s === "ABSENT"   ? "bg-red-500 text-white"
                              : s === "LATE"     ? "bg-yellow-500 text-white"
                              : "bg-blue-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {s === "PRESENT" ? "✓" : s === "ABSENT" ? "✗" : s === "LATE" ? "⏰" : "E"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setActiveSession(null)}>Cancel</Button>
              <Button loading={saving} onClick={saveAttendance}>Save Attendance</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
