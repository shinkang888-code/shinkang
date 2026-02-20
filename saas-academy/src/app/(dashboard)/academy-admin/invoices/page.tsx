"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";

interface Invoice {
  id: string;
  studentUserId: string;
  orderId: string;
  amount: number;
  dueDate: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED";
  paidAt: string | null;
  plan: { name: string; amount: number } | null;
  student: { id: string; name: string; email: string } | null;
  attempts: { attemptNo: number; status: string; requestedAt: string }[];
}

export default function InvoicesPage() {
  const { push: toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/academy/invoices?${params}`);
    if (res.ok) {
      const { data } = await res.json();
      setInvoices(data.items ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleRetry(invoice: Invoice) {
    if (!confirm(`Retry charge for ${invoice.student?.name ?? invoice.studentUserId}?`)) return;
    setRetrying(invoice.id);
    const res = await fetch(`/api/academy/invoices/${invoice.id}`, { method: "POST" });
    const body = await res.json();
    setRetrying(null);
    if (!res.ok) { toast(body.error ?? "Retry failed", "error"); return; }
    toast("Charge successful!", "success");
    load();
  }

  function statusVariant(s: string): "active" | "suspended" | "default" {
    if (s === "PAID")   return "active";
    if (s === "FAILED" || s === "CANCELED") return "suspended";
    return "default";
  }

  const columns = [
    { key: "orderId",  header: "Order ID",  render: (inv: Invoice) => <span className="font-mono text-xs">{inv.orderId}</span> },
    { key: "student",  header: "Student",   render: (inv: Invoice) => inv.student?.name ?? inv.studentUserId },
    { key: "plan",     header: "Plan",      render: (inv: Invoice) => inv.plan?.name ?? "—" },
    { key: "amount",   header: "Amount",    render: (inv: Invoice) => `₩${inv.amount.toLocaleString()}` },
    { key: "dueDate",  header: "Due",       render: (inv: Invoice) => inv.dueDate.slice(0, 10) },
    { key: "status",   header: "Status",    render: (inv: Invoice) => <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge> },
    { key: "paidAt",   header: "Paid At",   render: (inv: Invoice) => inv.paidAt ? inv.paidAt.slice(0, 10) : "—" },
    { key: "attempts", header: "Attempts",  render: (inv: Invoice) => String(inv.attempts?.length ?? 0) },
    {
      key: "actions", header: "Actions",
      render: (inv: Invoice) =>
        inv.status === "FAILED" || inv.status === "PENDING" ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={retrying === inv.id}
            onClick={() => handleRetry(inv)}
          >
            {retrying === inv.id ? "Retrying…" : "Retry"}
          </Button>
        ) : <span />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage billing invoices</p>
        </div>
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELED">Canceled</option>
        </select>
      </div>

      <Table columns={columns} rows={invoices} keyField="id" loading={loading} emptyMessage="No invoices found." />
      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
    </div>
  );
}
