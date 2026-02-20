"use client";

import { useState, useEffect, useCallback } from "react";
import { useSaasAuth } from "@/components/saas/useSaasAuth";
import {
  Users, Search, Loader2, RefreshCw,
  UserPlus, ShieldOff, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  ADMIN:   { label: "관리자",  cls: "bg-blue-100 text-blue-700" },
  TEACHER: { label: "선생님", cls: "bg-indigo-100 text-indigo-700" },
  STUDENT: { label: "원생",    cls: "bg-green-100 text-green-700" },
};
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "활성",  cls: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "정지",  cls: "bg-orange-100 text-orange-700" },
};

export default function AcademyAdminUsersPage() {
  const { user: me, authFetch } = useSaasAuth(["ADMIN", "TEACHER"]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "STUDENT" });
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        ...(search ? { search } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
      });
      const res = await authFetch(`/api/saas/academies/me/users?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.data.users);
      setTotal(data.data.pagination.total);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (me?.role !== "ADMIN") { toast.error("관리자만 생성할 수 있습니다."); return; }
    setCreating(true);
    try {
      const res = await authFetch("/api/saas/academies/me/users", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("사용자가 등록되었습니다.");
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", role: "STUDENT" });
      fetchUsers();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (me?.role !== "ADMIN") { toast.error("관리자만 변경할 수 있습니다."); return; }
    try {
      const res = await authFetch(`/api/saas/academies/me/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`상태 변경 완료`);
      fetchUsers();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={24} className="text-indigo-600" />
            원생 / 교사 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">전체 {total}명 · {me?.academy?.name}</p>
        </div>
        {me?.role === "ADMIN" && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700"
          >
            <UserPlus size={16} />
            사용자 추가
          </button>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-4">새 사용자 등록</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">이름 *</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="홍길동" required
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">이메일 *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="user@example.com" required
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">비밀번호 *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="8자 이상, 대문자+숫자" required
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">역할 *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="STUDENT">원생</option>
                  <option value="TEACHER">선생님</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  등록
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 flex gap-3 flex-wrap border-b border-gray-100">
          <div className="flex-1 min-w-48 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="이름 또는 이메일 검색"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">전체 역할</option>
            <option value="ADMIN">관리자</option>
            <option value="TEACHER">선생님</option>
            <option value="STUDENT">원생</option>
          </select>
          <button onClick={fetchUsers} className="border rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>등록된 사용자가 없습니다.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="text-left px-6 py-3 font-medium">이름</th>
                <th className="text-left px-6 py-3 font-medium">이메일</th>
                <th className="text-left px-6 py-3 font-medium">역할</th>
                <th className="text-left px-6 py-3 font-medium">상태</th>
                <th className="text-left px-6 py-3 font-medium">가입일</th>
                {me?.role === "ADMIN" && <th className="text-right px-6 py-3 font-medium">관리</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const rb = ROLE_BADGE[u.role];
                const sb = STATUS_BADGE[u.status];
                return (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${rb?.cls}`}>
                        {rb?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sb?.cls}`}>
                        {sb?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    {me?.role === "ADMIN" && (
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          {u.status === "ACTIVE" && (
                            <button
                              onClick={() => handleStatusChange(u.id, "SUSPENDED")}
                              title="정지"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                            >
                              <ShieldOff size={15} />
                            </button>
                          )}
                          {u.status === "SUSPENDED" && (
                            <button
                              onClick={() => handleStatusChange(u.id, "ACTIVE")}
                              title="활성화"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                            >
                              <ShieldCheck size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {total > 20 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-100">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">이전</button>
            <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)}
              className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">다음</button>
          </div>
        )}
      </div>
    </div>
  );
}
