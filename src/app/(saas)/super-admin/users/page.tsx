"use client";

import { useState, useEffect, useCallback } from "react";
import { useSaasAuth } from "@/components/saas/useSaasAuth";
import { Users, Search, Loader2, RefreshCw, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  academyId: string | null;
  createdAt: string;
  academy?: { id: string; name: string; code: string } | null;
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  SUPER_ADMIN: { label: "슈퍼어드민", cls: "bg-purple-100 text-purple-700" },
  ADMIN:       { label: "학원관리자",  cls: "bg-blue-100 text-blue-700" },
  TEACHER:     { label: "선생님",       cls: "bg-indigo-100 text-indigo-700" },
  STUDENT:     { label: "원생",         cls: "bg-green-100 text-green-700" },
};
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "활성",  cls: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "정지",  cls: "bg-orange-100 text-orange-700" },
  DELETED:   { label: "삭제",  cls: "bg-red-100 text-red-500" },
};

export default function SuperAdminUsersPage() {
  const { authFetch } = useSaasAuth("SUPER_ADMIN");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        ...(search ? { search } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await authFetch(`/api/saas/admin/users?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.data.users);
      setTotal(data.data.pagination.total);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, search, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await authFetch(`/api/saas/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`상태가 ${STATUS_BADGE[status]?.label}로 변경되었습니다.`);
      fetchUsers();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to update");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={24} className="text-purple-600" />
            전체 사용자 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">전체 {total}명</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {/* Filters */}
        <div className="p-4 flex gap-3 flex-wrap border-b border-gray-100">
          <div className="flex-1 min-w-48 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="이름 또는 이메일 검색"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">전체 역할</option>
            <option value="SUPER_ADMIN">슈퍼어드민</option>
            <option value="ADMIN">학원관리자</option>
            <option value="TEACHER">선생님</option>
            <option value="STUDENT">원생</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">전체 상태</option>
            <option value="ACTIVE">활성</option>
            <option value="SUSPENDED">정지</option>
          </select>
          <button onClick={fetchUsers} className="border rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-purple-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>사용자가 없습니다.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="text-left px-6 py-3 font-medium">이름</th>
                <th className="text-left px-6 py-3 font-medium">이메일</th>
                <th className="text-left px-6 py-3 font-medium">학원</th>
                <th className="text-left px-6 py-3 font-medium">역할</th>
                <th className="text-left px-6 py-3 font-medium">상태</th>
                <th className="text-left px-6 py-3 font-medium">가입일</th>
                <th className="text-right px-6 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const rb = ROLE_BADGE[u.role];
                const sb = STATUS_BADGE[u.status];
                return (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{u.email}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {u.academy ? (
                        <span>
                          {u.academy.name}
                          <code className="ml-1 text-xs bg-gray-100 px-1 rounded">{u.academy.code}</code>
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
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
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        {u.status === "ACTIVE" && u.role !== "SUPER_ADMIN" && (
                          <button
                            onClick={() => handleStatusChange(u.id, "SUSPENDED")}
                            title="계정 정지"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                          >
                            <ShieldOff size={15} />
                          </button>
                        )}
                        {u.status === "SUSPENDED" && (
                          <button
                            onClick={() => handleStatusChange(u.id, "ACTIVE")}
                            title="계정 활성화"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                          >
                            <ShieldCheck size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
            >이전</button>
            <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {Math.ceil(total / 20)}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / 20)}
              className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
            >다음</button>
          </div>
        )}
      </div>
    </div>
  );
}
