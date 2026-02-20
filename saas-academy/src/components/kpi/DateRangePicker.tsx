"use client";
/**
 * src/components/kpi/DateRangePicker.tsx
 *
 * Date range picker with quick-select presets.
 * Calls onChange({ from, to }) with "YYYY-MM-DD" strings.
 */

import React, { useState } from "react";

export interface DateRange {
  from: string;
  to:   string;
}

interface Props {
  value:    DateRange;
  onChange: (range: DateRange) => void;
}

// ── KST helpers ───────────────────────────────────────────────────────────────

function todayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function kstMonthBounds(monthOffset = 0): DateRange {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setMonth(kst.getMonth() + monthOffset, 1);
  const year  = kst.getFullYear();
  const month = kst.getMonth(); // 0-based
  const lastDay = new Date(year, month + 1, 0).getDate();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to   = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function last30Days(): DateRange {
  const today = todayKST();
  const dt    = new Date(`${today}T00:00:00+09:00`);
  dt.setDate(dt.getDate() - 29);
  const from = dt.toISOString().slice(0, 10);
  return { from, to: today };
}

const PRESETS: Array<{ label: string; getRange: () => DateRange }> = [
  { label: "이번 달",    getRange: () => kstMonthBounds(0)  },
  { label: "지난 달",    getRange: () => kstMonthBounds(-1) },
  { label: "최근 30일", getRange: () => last30Days()        },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function DateRangePicker({ value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [draft, setDraft]           = useState<DateRange>(value);

  function applyPreset(range: DateRange) {
    onChange(range);
    setDraft(range);
    setShowCustom(false);
  }

  function applyCustom() {
    if (draft.from > draft.to) return;
    onChange(draft);
    setShowCustom(false);
  }

  const activePreset = PRESETS.find((p) => {
    const r = p.getRange();
    return r.from === value.from && r.to === value.to;
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => applyPreset(p.getRange())}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activePreset?.label === p.label
              ? "bg-brand-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {p.label}
        </button>
      ))}

      {/* Custom range toggle */}
      <button
        onClick={() => setShowCustom(!showCustom)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
          !activePreset
            ? "bg-brand-600 text-white border-brand-600"
            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        {!activePreset ? `${value.from} ~ ${value.to}` : "직접 입력"}
      </button>

      {/* Custom range inline inputs */}
      {showCustom && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
          <input
            type="date"
            value={draft.from}
            max={draft.to}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className="text-sm border-none outline-none text-gray-700 cursor-pointer"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={draft.to}
            min={draft.from}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            className="text-sm border-none outline-none text-gray-700 cursor-pointer"
          />
          <button
            onClick={applyCustom}
            disabled={draft.from > draft.to}
            className="ml-2 px-2 py-0.5 bg-brand-600 text-white text-xs rounded disabled:opacity-50"
          >
            적용
          </button>
        </div>
      )}
    </div>
  );
}
