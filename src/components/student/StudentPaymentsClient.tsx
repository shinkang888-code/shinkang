"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import type { PaymentDTO } from "@/types";

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PAID: { label: "납부완료", icon: <CheckCircle size={14} />, color: "text-emerald-600" },
  PENDING: { label: "미납", icon: <AlertCircle size={14} />, color: "text-amber-600" },
  OVERDUE: { label: "연체", icon: <AlertCircle size={14} />, color: "text-red-600" },
  CANCELLED: { label: "취소", icon: null, color: "text-gray-400" },
};

const METHOD_MAP: Record<string, string> = {
  CASH: "현금",
  BANK_TRANSFER: "계좌이체",
  CARD: "카드",
  OTHER: "기타",
};

export function StudentPaymentsClient() {
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/payments")
      .then((r) => r.json())
      .then((j) => setPayments(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const pending = payments.filter((p) => p.status !== "PAID" && p.status !== "CANCELLED");
  const paid = payments.filter((p) => p.status === "PAID");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">납부 내역</h1>
        <p className="text-sm text-gray-500 mt-1">수강료 납부 현황을 확인하세요</p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <CheckCircle size={18} className="text-emerald-500" />
              </div>
              <p className="text-sm text-gray-500">납부 완료</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {paid.reduce((s, p) => s + p.amount, 0).toLocaleString()}원
            </p>
            <p className="text-xs text-gray-400 mt-1">{paid.length}건</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertCircle size={18} className="text-amber-500" />
              </div>
              <p className="text-sm text-gray-500">미납 금액</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {pending.reduce((s, p) => s + p.amount, 0).toLocaleString()}원
            </p>
            <p className="text-xs text-gray-400 mt-1">{pending.length}건</p>
          </CardContent>
        </Card>
      </div>

      {/* 납부 목록 */}
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard size={16} className="text-gray-400" />
            전체 납부 내역
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-gray-400">불러오는 중...</p>
          ) : payments.length === 0 ? (
            <p className="text-center py-8 text-gray-400">납부 내역이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => {
                const statusInfo = STATUS_MAP[p.status];
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      p.status === "OVERDUE" ? "border-red-100 bg-red-50/50" :
                      p.status === "PENDING" ? "border-amber-100 bg-amber-50/50" :
                      "border-gray-100 bg-gray-50/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {p.billingMonth} 수강료
                        </p>
                        <div className={`flex items-center gap-1 text-xs ${statusInfo?.color}`}>
                          {statusInfo?.icon}
                          <span>{statusInfo?.label}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        납부 예정: {new Date(p.dueDate).toLocaleDateString("ko-KR")}
                        {p.paidAt && ` · 납부: ${new Date(p.paidAt).toLocaleDateString("ko-KR")}`}
                        {p.method && ` (${METHOD_MAP[p.method] ?? p.method})`}
                      </p>
                      {p.memo && <p className="text-xs text-gray-400 mt-0.5">{p.memo}</p>}
                    </div>
                    <p className="text-lg font-bold text-gray-900">{p.amount.toLocaleString()}원</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
