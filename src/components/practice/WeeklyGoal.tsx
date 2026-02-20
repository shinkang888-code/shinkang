"use client";

import { Progress } from "@/components/ui/progress";
import { Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeeklyGoalProps {
  weekStart: string;
  weekEnd: string;
  weekTargetCount: number;
  actualCount: number;
  achieved: boolean;
}

export function WeeklyGoal({
  weekStart,
  weekEnd,
  weekTargetCount,
  actualCount,
  achieved,
}: WeeklyGoalProps) {
  const pct = Math.min(100, (actualCount / weekTargetCount) * 100);

  return (
    <div
      className={cn(
        "rounded-xl p-4 border",
        achieved
          ? "bg-green-50 border-green-200"
          : "bg-white border-gray-200"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {achieved ? (
            <Trophy className="h-5 w-5 text-yellow-500" />
          ) : (
            <Target className="h-5 w-5 text-blue-500" />
          )}
          <span className="font-semibold text-sm">
            {achieved ? "🎉 이번 주 목표 달성!" : "이번 주 연습 목표"}
          </span>
        </div>
        <span className="text-sm font-bold">
          {actualCount}
          <span className="text-gray-400 font-normal"> / {weekTargetCount}회</span>
        </span>
      </div>

      <Progress value={pct} className={cn("h-3", achieved && "[&>div]:bg-green-500")} />

      <p className="text-xs text-gray-500 mt-2">
        {weekStart} ~ {weekEnd}
        {!achieved && (
          <span className="ml-2 text-blue-600">
            {weekTargetCount - actualCount}회 더 제출하면 달성!
          </span>
        )}
      </p>
    </div>
  );
}
