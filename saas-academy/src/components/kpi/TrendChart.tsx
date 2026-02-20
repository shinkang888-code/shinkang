"use client";
/**
 * src/components/kpi/TrendChart.tsx
 *
 * Thin recharts wrapper for KPI trend lines.
 * Supports a single series with optional percentage formatting.
 */

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { TimePoint } from "@/lib/kpi/types";

interface TrendChartProps {
  data:         TimePoint[];
  title:        string;
  color?:       string;
  isPercent?:   boolean;   // format Y-axis as %
  formatValue?: (v: number) => string;
  height?:      number;
}

function defaultFmt(v: number, isPercent: boolean): string {
  if (isPercent) return `${(v * 100).toFixed(1)}%`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function TrendChart({
  data,
  title,
  color       = "#6366f1",
  isPercent   = false,
  formatValue,
  height      = 200,
}: TrendChartProps) {
  const fmt = formatValue ?? ((v: number) => defaultFmt(v, isPercent));

  // Shorten date labels: keep only MM-DD or Wxx
  const labelData = data.map((p) => ({
    ...p,
    label: p.date.slice(5), // "MM-DD"
  }));

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={labelData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => fmt(v)}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip
            formatter={(v: number) => [fmt(v), title]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={data.length <= 31 ? { r: 2, fill: color } : false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
