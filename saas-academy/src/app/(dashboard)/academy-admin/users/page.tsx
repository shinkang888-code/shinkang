"use client";
import { useEffect, useState, useCallback } from "react";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";

interface User {
  id: string; name: string; email: string;
  role: string; status: "ACTIVE" | "SUSPENDED"; createdAt: string;
}

export default function AcademyUsersPage() {
  const { push: toast } = useToast();
  const [users, setUsers]   = useState<User[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole]     = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm]     = useState({ name: "", email: "", password: "", role: "STUDENT" });
  const [creating, setCreating] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({
      page: String(page), limit: String(LIMIT),
      ...(search && { search }),
      ...(role   && { role }),
    });
    const res = await fetch(`/api/academy/users?${p}`);
    if (res.ok) { const { data } = await res.json(); setUsers(data.users); setTotal(data.total); }
    setLoading(false);
  }, [page, search, role]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setCreating(true);
    const res = await fetch("/api/academy/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) { toast(body.error ?? "Create failed", "error"); return; }
    toast("User created!", "success");
    setCreateOpen(false);
    setForm({ name: "", email: "", password: "", role: "STUDENT" });
    load();
  }

  async function toggleStatus(user: User) {
    const newStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/academy/users/${user.id}`, {
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
    { key: "role",  header: "Role", render: (u: User) => <Badge variant="role">{u.role}</Badge> },
    {
      key: "status", header: "Status",
      render: (u: User) => (
        <Badge variant={u.status === "ACTIVE" ? "active" : "suspended"}>{u.status}</Badge>
      ),
    },
    { key: "createdAt", header: "Joined",
      render: (u: User) => new Date(u.createdAt).toLocaleDateString() },
    {
      key: "actions", header: "",
      render: (u: User) => (
        <Button size="sm" variant={u.status === "ACTIVE" ? "danger" : "secondary"}
          onClick={() => toggleStatus(u)}>
          {u.status === "ACTIVE" ? "Suspend" : "Activate"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Button onClick={() => setCreateOpen(true)}>+ Add User</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="w-64">
          <Input placeholder="Search…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="input w-36">
          <option value="">All roles</option>
          {["ADMIN","TEACHER","STUDENT"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <Table columns={columns} rows={users} keyField="id" loading={loading} />
      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={creating} onClick={handleCreate}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Email" type="email" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Password" type="password" value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <div>
            <label className="label">Role</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="input">
              <option value="STUDENT">STUDENT</option>
              <option value="TEACHER">TEACHER</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
