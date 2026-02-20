"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";

interface Academy {
  id: string; name: string; code: string;
  status: "ACTIVE" | "SUSPENDED"; createdAt: string;
  _count: { users: number };
}
interface User {
  id: string; name: string; email: string;
  role: string; status: "ACTIVE" | "SUSPENDED"; createdAt: string;
}

export default function AcademyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { push: toast } = useToast();

  const [academy, setAcademy] = useState<Academy | null>(null);
  const [users, setUsers]     = useState<User[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const LIMIT = 20;

  const loadAcademy = useCallback(async () => {
    const res = await fetch(`/api/admin/academies/${id}`);
    if (res.ok) setAcademy((await res.json()).data);
  }, [id]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ academyId: id, page: String(page), limit: String(LIMIT) });
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const { data } = await res.json();
      setUsers(data.users); setTotal(data.total);
    }
    setLoading(false);
  }, [id, page]);

  useEffect(() => { loadAcademy(); loadUsers(); }, [loadAcademy, loadUsers]);

  async function toggleAcademyStatus() {
    if (!academy) return;
    const newStatus = academy.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/admin/academies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) { toast("Failed", "error"); return; }
    toast(`Academy ${newStatus.toLowerCase()}`, "success");
    setSuspendOpen(false);
    loadAcademy();
  }

  async function toggleUserStatus(user: User) {
    const newStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) { toast("Failed", "error"); return; }
    toast(`User ${newStatus.toLowerCase()}`, "success");
    loadUsers();
  }

  const userColumns = [
    { key: "name",  header: "Name" },
    { key: "email", header: "Email" },
    { key: "role",  header: "Role",
      render: (u: User) => <Badge variant="role">{u.role}</Badge> },
    { key: "status", header: "Status",
      render: (u: User) => (
        <Badge variant={u.status === "ACTIVE" ? "active" : "suspended"}>{u.status}</Badge>
      ),
    },
    { key: "createdAt", header: "Joined",
      render: (u: User) => new Date(u.createdAt).toLocaleDateString() },
    { key: "actions", header: "",
      render: (u: User) => (
        <Button
          size="sm"
          variant={u.status === "ACTIVE" ? "danger" : "secondary"}
          onClick={() => toggleUserStatus(u)}
        >
          {u.status === "ACTIVE" ? "Suspend" : "Activate"}
        </Button>
      ),
    },
  ];

  if (!academy) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-sm text-brand-600 hover:underline">
        ← Back to Academies
      </button>

      {/* Header */}
      <div className="card p-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{academy.name}</h1>
          <p className="text-gray-500 mt-1">Code: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">{academy.code}</code></p>
          <div className="mt-2">
            <Badge variant={academy.status === "ACTIVE" ? "active" : "suspended"}>
              {academy.status}
            </Badge>
          </div>
        </div>
        <Button
          variant={academy.status === "ACTIVE" ? "danger" : "secondary"}
          onClick={() => setSuspendOpen(true)}
        >
          {academy.status === "ACTIVE" ? "Suspend Academy" : "Activate Academy"}
        </Button>
      </div>

      {/* Users */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Users ({total})</h2>
        <Table columns={userColumns} rows={users} keyField="id" loading={loading} />
        <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
      </div>

      {/* Confirm modal */}
      <Modal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title={academy.status === "ACTIVE" ? "Suspend Academy?" : "Activate Academy?"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button
              variant={academy.status === "ACTIVE" ? "danger" : "primary"}
              onClick={toggleAcademyStatus}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-gray-600 text-sm">
          {academy.status === "ACTIVE"
            ? "All users in this academy will be blocked from logging in."
            : "Users in this academy will be able to log in again."}
        </p>
      </Modal>
    </div>
  );
}
