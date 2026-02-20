"use client";
import { useEffect, useState, useCallback } from "react";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";

interface Invoice {
  id: string;
  orderId: string;
  amount: number;
  dueDate: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED";
  paidAt: string | null;
  plan: { name: string } | null;
  attempts: { attemptNo: number; status: string }[];
}

export default function StudentInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/me/invoices?page=${page}&limit=${LIMIT}`);
    if (res.ok) {
      const { data } = await res.json();
      setInvoices(data.items ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function statusVariant(s: string): "active" | "suspended" | "default" {
    if (s === "PAID")   return "active";
    if (s === "FAILED" || s === "CANCELED") return "suspended";
    return "default";
  }

  const columns = [
    { key: "plan",     header: "Plan",   render: (inv: Invoice) => inv.plan?.name ?? "—" },
    { key: "amount",   header: "Amount", render: (inv: Invoice) => `₩${inv.amount.toLocaleString()}` },
    { key: "dueDate",  header: "Due",    render: (inv: Invoice) => inv.dueDate.slice(0, 10) },
    { key: "status",   header: "Status", render: (inv: Invoice) => <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge> },
    { key: "paidAt",   header: "Paid",   render: (inv: Invoice) => inv.paidAt ? inv.paidAt.slice(0, 10) : "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">Your tuition billing history</p>
      </div>

      <Table columns={columns} rows={invoices} keyField="id" loading={loading} emptyMessage="No invoices yet." />
      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
    </div>
  );
}
