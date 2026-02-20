"use client";
import { useEffect, useState, useCallback } from "react";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";

interface User {
  id: string; name: string; email: string;
  role: string; status: "ACTIVE" | "SUSPENDED"; createdAt: string;
  academy: { name: string; code: string } | null;
}

export default function AllUsersPage() {
  const { push: toast } = useToast();
  const [users, setUsers]   = useState<User[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole]     = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "SUSPENDED">("");
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({
      page: String(page), limit: String(LIMIT),
      ...(search && { search }),
      ...(role   && { role }),
      ...(status && { status }),
    });
    const res = await fetch(`/api/admin/users?${p}`);
    if (res.ok) { const { data } = await res.json(); setUsers(data.users); setTotal(data.total); }
    setLoading(false);
  }, [page, search, role, status]);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus(user: User) {
    const newStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) { toast("Failed", "error"); return; }
    toast(`User ${newStatus.toLowerCase()}`, "success");
    load();
  }

  const columns = [
    { key: "name",  header: "Name" },
    { key: "email", header: "Email" },
    { key: "role",  header: "Role",   render: (u: User) => <Badge variant="role">{u.role}</Badge> },
    { key: "status", header: "Status",
      render: (u: User) => (
        <Badge variant={u.status === "ACTIVE" ? "active" : "suspended"}>{u.status}</Badge>
      ),
    },
    { key: "academy", header: "Academy",
      render: (u: User) => u.academy ? `${u.academy.name} (${u.academy.code})` : "—",
    },
    { key: "createdAt", header: "Joined",
      render: (u: User) => new Date(u.createdAt).toLocaleDateString(),
    },
    { key: "actions", header: "",
      render: (u: User) =>
        u.role !== "SUPER_ADMIN" ? (
          <Button
            size="sm"
            variant={u.status === "ACTIVE" ? "danger" : "secondary"}
            onClick={() => toggleStatus(u)}
          >
            {u.status === "ACTIVE" ? "Suspend" : "Activate"}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">All Users</h1>
      <div className="flex gap-3 flex-wrap">
        <div className="w-64">
          <Input placeholder="Search name or email…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="input w-36">
          <option value="">All roles</option>
          {["SUPER_ADMIN","ADMIN","TEACHER","STUDENT"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1); }} className="input w-40">
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
      </div>
      <Table columns={columns} rows={users} keyField="id" loading={loading} />
      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
    </div>
  );
}
