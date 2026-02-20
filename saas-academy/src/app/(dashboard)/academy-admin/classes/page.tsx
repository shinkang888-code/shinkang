"use client";
/**
 * /academy-admin/classes
 * Lists all classes for the admin's academy with enrollment counts.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface ClassItem {
  id:            string;
  name:          string;
  status:        string;
  startDate:     string;
  endDate:       string | null;
  teacher:       { id: string; name: string } | null;
  schedules:     { daysOfWeek: number[]; startTime: string; durationMin: number }[];
  _count:        { enrollments: number; sessions: number };
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function scheduleLabel(s: ClassItem["schedules"][number]) {
  return `${s.daysOfWeek.map((d) => DOW[d]).join("/")} ${s.startTime} (${s.durationMin}min)`;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/academy/classes");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setClasses(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <Link href="/academy-admin/classes/new">
          <Button>+ New Class</Button>
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : classes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">🏫</p>
          <p>No classes yet. Create your first class!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/academy-admin/classes/${cls.id}`}
              className="block bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-brand-500 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">{cls.name}</h2>
                    <Badge variant={cls.status === "ACTIVE" ? "active" : "default"}>
                      {cls.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    Teacher: {cls.teacher?.name ?? "—"} &nbsp;·&nbsp;
                    Start: {new Date(cls.startDate).toLocaleDateString("ko-KR")}
                    {cls.endDate && ` ~ ${new Date(cls.endDate).toLocaleDateString("ko-KR")}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cls.schedules.map((s, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {scheduleLabel(s)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500 space-y-1 ml-4 shrink-0">
                  <div><span className="font-medium text-gray-900">{cls._count.enrollments}</span> students</div>
                  <div><span className="font-medium text-gray-900">{cls._count.sessions}</span> sessions</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
