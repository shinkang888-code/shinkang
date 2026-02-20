"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, CheckCircle, AlertTriangle } from "lucide-react";
import type { PaymentDTO } from "@/types";

interface Props {
  studioId: string;
  students: { id: string; name: string }[];
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PAID: { label: "납부완료", variant: "default" },
  PENDING: { label: "미납", variant: "secondary" },
  OVERDUE: { label: "연체", variant: "destructive" },
  CANCELLED: { label: "취소", variant: "outline" },
};

export function PaymentsClient({ studioId, students }: Props) {
  const [payments, setPayments] = useState<(PaymentDTO & { student: { user: { name?: string | null } } })[]>([]);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    studentId: "", amount: "150000", billingMonth: new Date().toISOString().slice(0, 7),
    dueDate: "", memo: "",
  });

  const fetchPayments = () => {
    setLoading(true);
    const params = new URLSearchParams({ studioId, month: filterMonth });
    if (filterStatus !== "ALL") params.set("status", filterStatus);
    fetch(`/api/admin/payments?${params}`)
      .then((r) => r.json())
      .then((j) => setPayments(j.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayments(); }, [studioId, filterMonth, filterStatus]);

  const handleMarkPaid = async (paymentId: string) => {
    const res = await fetch(`/api/admin/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString(), method: "BANK_TRANSFER" }),
    });
    if (res.ok) { toast.success("납부 완료 처리되었습니다."); fetchPayments(); }
  };

  const handleCreate = async () => {
    if (!newPayment.studentId || !newPayment.dueDate) {
      toast.error("원생과 납부 예정일을 입력하세요.");
      return;
    }
    const res = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newPayment, studioId, amount: parseInt(newPayment.amount), dueDate: new Date(newPayment.dueDate).toISOString() }),
    });
    const json = await res.json();
    if (res.ok) { toast.success("수강료가 등록되었습니다."); setOpen(false); fetchPayments(); }
    else toast.error(json.error ?? "등록 실패");
  };

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => p.status !== "PAID" && p.status !== "CANCELLED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">수강료 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filterMonth} · 납부완료 {totalPaid.toLocaleString()}원 · 미납 {totalPending}건
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />수강료 등록</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>수강료 등록</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>원생 *</Label>
                <Select value={newPayment.studentId} onValueChange={(v) => setNewPayment((p) => ({ ...p, studentId: v }))}>
                  <SelectTrigger><SelectValue placeholder="원생 선택..." /></SelectTrigger>
                  <SelectContent>
                    {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>청구 월 *</Label>
                  <Input type="month" value={newPayment.billingMonth}
                    onChange={(e) => setNewPayment((p) => ({ ...p, billingMonth: e.target.value }))} />
                </div>
                <div>
                  <Label>금액 (원) *</Label>
                  <Input type="number" value={newPayment.amount}
                    onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>납부 예정일 *</Label>
                <Input type="date" value={newPayment.dueDate}
                  onChange={(e) => setNewPayment((p) => ({ ...p, dueDate: e.target.value }))} />
              </div>
              <div>
                <Label>메모</Label>
                <Input value={newPayment.memo}
                  onChange={(e) => setNewPayment((p) => ({ ...p, memo: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
                <Button onClick={handleCreate}>등록</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="PENDING">미납</SelectItem>
            <SelectItem value="OVERDUE">연체</SelectItem>
            <SelectItem value="PAID">납부완료</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 shadow-sm rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>원생</TableHead>
                <TableHead>청구월</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>납부예정일</TableHead>
                <TableHead>납부일</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">불러오는 중...</TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">등록된 수강료가 없습니다.</TableCell>
                </TableRow>
              ) : payments.map((p) => (
                <TableRow key={p.id} className="hover:bg-gray-50/50">
                  <TableCell className="font-medium">{p.student?.user?.name ?? "-"}</TableCell>
                  <TableCell>{p.billingMonth}</TableCell>
                  <TableCell className="font-semibold">{p.amount.toLocaleString()}원</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(p.dueDate).toLocaleDateString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString("ko-KR") : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_LABELS[p.status]?.variant ?? "secondary"}>
                      {STATUS_LABELS[p.status]?.label ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {(p.status === "PENDING" || p.status === "OVERDUE") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkPaid(p.id)}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <CheckCircle size={14} className="mr-1" />
                        납부완료
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
