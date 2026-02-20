"use client";
import { useEffect, useState, useCallback } from "react";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";

interface Academy {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  _count: { users: number };
}

export default function AcademiesPage() {
  const { push: toast } = useToast();
  const router = useRouter();

  const [academies, setAcademies] = useState<Academy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "SUSPENDED">("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [creating, setCreating] = useState(false);

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      ...(search && { search }),
      ...(status && { status }),
    });
    const res = await fetch(`/api/admin/academies?${params}`);
    if (res.ok) {
      const { data } = await res.json();
      setAcademies(data.academies);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setCreating(true);
    const res = await fetch("/api/admin/academies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, code: form.code.toUpperCase() }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) { toast(body.error ?? "Create failed", "error"); return; }
    toast("Academy created!", "success");
    setCreateOpen(false);
    setForm({ name: "", code: "" });
    load();
  }

  async function toggleStatus(academy: Academy) {
    const newStatus = academy.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/admin/academies/${academy.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) { toast("Update failed", "error"); return; }
    toast(`Academy ${newStatus === "SUSPENDED" ? "suspended" : "activated"}`, "success");
    load();
  }

  async function handleDelete(academy: Academy) {
    if (!confirm(`Delete "${academy.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/academies/${academy.id}`, { method: "DELETE" });
    if (!res.ok) { toast("Delete failed", "error"); return; }
    toast("Academy deleted", "success");
    load();
  }

  const columns = [
    { key: "name",   header: "Name" },
    { key: "code",   header: "Code" },
    {
      key: "status", header: "Status",
      render: (a: Academy) => (
        <Badge variant={a.status === "ACTIVE" ? "active" : "suspended"}>
          {a.status}
        </Badge>
      ),
    },
    {
      key: "_count", header: "Users",
      render: (a: Academy) => a._count.users,
    },
    {
      key: "createdAt", header: "Created",
      render: (a: Academy) => new Date(a.createdAt).toLocaleDateString(),
    },
    {
      key: "actions", header: "",
      render: (a: Academy) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={a.status === "ACTIVE" ? "danger" : "secondary"}
            onClick={() => toggleStatus(a)}
          >
            {a.status === "ACTIVE" ? "Suspend" : "Activate"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/super-admin/academies/${a.id}`)}
          >
            View
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(a)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Academies</h1>
        <Button onClick={() => setCreateOpen(true)}>+ New Academy</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="w-64">
          <Input
            placeholder="Search name or code…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
          className="input w-40"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
      </div>

      <Table columns={columns} rows={academies} keyField="id" loading={loading} />
      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Academy"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Academy Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Alpha Academy"
          />
          <Input
            label="Short Code (unique, uppercase)"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="ALPHA-01"
          />
        </div>
      </Modal>
    </div>
  );
}
