"use client";
/**
 * /academy-admin/classes/new
 * Create a new class with schedule and generate sessions.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ScheduleRule {
  daysOfWeek:  number[];
  startTime:   string;
  durationMin: number;
}

export default function NewClassPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Form fields
  const [name,          setName]          = useState("");
  const [startDate,     setStartDate]     = useState("");
  const [endDate,       setEndDate]       = useState("");
  const [capacity,      setCapacity]      = useState("");
  const [generateWeeks, setGenerateWeeks] = useState(8);
  const [schedules,     setSchedules]     = useState<ScheduleRule[]>([
    { daysOfWeek: [1], startTime: "15:00", durationMin: 60 },
  ]);

  function addSchedule() {
    setSchedules((prev) => [...prev, { daysOfWeek: [1], startTime: "15:00", durationMin: 60 }]);
  }

  function removeSchedule(i: number) {
    setSchedules((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toggleDow(schedIdx: number, dow: number) {
    setSchedules((prev) =>
      prev.map((s, i) =>
        i !== schedIdx
          ? s
          : {
              ...s,
              daysOfWeek: s.daysOfWeek.includes(dow)
                ? s.daysOfWeek.filter((d) => d !== dow)
                : [...s.daysOfWeek, dow].sort(),
            },
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate) {
      setError("Name and Start Date are required.");
      return;
    }
    if (schedules.some((s) => s.daysOfWeek.length === 0)) {
      setError("Each schedule must have at least one day.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/academy/classes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          name.trim(),
          startDate,
          endDate:       endDate || null,
          capacity:      capacity ? parseInt(capacity, 10) : null,
          schedules,
          generateWeeks,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create class");
      router.push(`/academy-admin/classes/${json.data.class.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Class</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 초급 피아노반" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (optional)</label>
            <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Unlimited" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Generate sessions (weeks)</label>
            <Input type="number" min="1" max="52" value={generateWeeks} onChange={(e) => setGenerateWeeks(parseInt(e.target.value, 10))} />
          </div>
        </div>

        {/* Schedules */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">Weekly Schedules *</label>
            <Button type="button" variant="secondary" size="sm" onClick={addSchedule}>+ Add Schedule</Button>
          </div>
          <div className="space-y-4">
            {schedules.map((s, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Schedule {i + 1}</span>
                  {schedules.length > 1 && (
                    <button type="button" onClick={() => removeSchedule(i)} className="text-red-500 text-xs hover:underline">Remove</button>
                  )}
                </div>

                {/* Days of week */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">Days of week</p>
                  <div className="flex gap-2 flex-wrap">
                    {DOW_LABELS.map((label, dow) => (
                      <button
                        key={dow}
                        type="button"
                        onClick={() => toggleDow(i, dow)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          s.daysOfWeek.includes(dow)
                            ? "bg-brand-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Time (KST)</label>
                    <input
                      type="time"
                      value={s.startTime}
                      onChange={(e) => setSchedules((prev) => prev.map((r, idx) => idx === i ? { ...r, startTime: e.target.value } : r))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={s.durationMin}
                      onChange={(e) => setSchedules((prev) => prev.map((r, idx) => idx === i ? { ...r, durationMin: parseInt(e.target.value, 10) } : r))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={loading}>Create Class</Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
