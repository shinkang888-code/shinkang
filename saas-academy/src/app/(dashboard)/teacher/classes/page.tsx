"use client";
/**
 * /teacher/classes
 * Teacher: view assigned classes.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface ClassItem {
  id:        string;
  name:      string;
  status:    string;
  startDate: string;
  endDate:   string | null;
  schedules: { daysOfWeek: number[]; startTime: string; durationMin: number }[];
  _count:    { enrollments: number; sessions: number };
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Classes</h1>

      {error   && <p className="text-red-600">{error}</p>}
      {loading && <div className="flex justify-center py-20"><Spinner /></div>}

      {!loading && classes.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">🏫</p>
          <p>No classes assigned to you yet.</p>
        </div>
      )}

      {!loading && classes.length > 0 && (
        <div className="grid gap-4">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/teacher/classes/${cls.id}`}
              className="block bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-brand-500 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">{cls.name}</h2>
                    <Badge variant={cls.status === "ACTIVE" ? "active" : "default"}>{cls.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(cls.startDate).toLocaleDateString("ko-KR")}
                    {cls.endDate && ` ~ ${new Date(cls.endDate).toLocaleDateString("ko-KR")}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cls.schedules.map((s, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {s.daysOfWeek.map((d) => DOW[d]).join("/")} {s.startTime} ({s.durationMin}min)
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500 space-y-1">
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
