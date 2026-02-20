"use client";
/**
 * src/components/kpi/KpiCard.tsx
 *
 * Reusable metric card for the KPI dashboard.
 * Shows: label, primary value, optional sub-value, optional delta badge.
 */

import React from "react";

interface KpiCardProps {
  label:      string;
  value:      string | number;
  subLabel?:  string;
  subValue?:  string | number;
  icon?:      string;
  color?:     "blue" | "green" | "yellow" | "red" | "purple" | "gray";
  loading?:   boolean;
}

const COLOR_MAP = {
  blue:   { bg: "bg-blue-50",   icon: "bg-blue-100 text-blue-600",   border: "border-blue-100" },
  green:  { bg: "bg-green-50",  icon: "bg-green-100 text-green-600",  border: "border-green-100" },
  yellow: { bg: "bg-yellow-50", icon: "bg-yellow-100 text-yellow-600", border: "border-yellow-100" },
  red:    { bg: "bg-red-50",    icon: "bg-red-100 text-red-600",      border: "border-red-100" },
  purple: { bg: "bg-purple-50", icon: "bg-purple-100 text-purple-600", border: "border-purple-100" },
  gray:   { bg: "bg-gray-50",   icon: "bg-gray-100 text-gray-500",    border: "border-gray-100" },
};

export function KpiCard({
  label,
  value,
  subLabel,
  subValue,
  icon = "📊",
  color = "blue",
  loading = false,
}: KpiCardProps) {
  const c = COLOR_MAP[color];

  if (loading) {
    return (
      <div className={`rounded-xl border ${c.border} ${c.bg} p-5 animate-pulse`}>
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-20" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className={`text-lg ${c.icon} rounded-lg p-1.5`}>{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      {subLabel && subValue !== undefined && (
        <p className="text-xs text-gray-500 mt-1">
          {subLabel}:{" "}
          <span className="font-medium text-gray-700">{subValue}</span>
        </p>
      )}
    </div>
  );
}
