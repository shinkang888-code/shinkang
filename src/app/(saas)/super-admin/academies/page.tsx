"use client";

import { useState, useEffect, useCallback } from "react";
import { useSaasAuth } from "@/components/saas/useSaasAuth";
import {
  Plus, Search, Loader2, Building2,
  CheckCircle, XCircle, Trash2, Eye, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

interface Academy {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: string;
  _count?: { users: number };
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "활성", cls: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "정지", cls: "bg-orange-100 text-orange-700" },
  DELETED: { label: "삭제", cls: "bg-red-100 text-red-500" },
};

export default function SuperAdminAcademiesPage() {
  const { authFetch } = useSaasAuth("SUPER_ADMIN");
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", code: "" });
  const [creating, setCreating] = useState(false);

  const fetchAcademies = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await authFetch(`/api/saas/admin/academies?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAcademies(data.data.academies);
      setTotal(data.data.pagination.total);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to load academies");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, search, statusFilter]);

  useEffect(() => { fetchAcademies(); }, [fetchAcademies]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await authFetch("/api/saas/admin/academies", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("학원이 생성되었습니다.");
      setShowCreate(false);
      setCreateForm({ name: "", code: "" });
      fetchAcademies();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await authFetch(`/api/saas/admin/academies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`학원 상태가 ${STATUS_BADGE[status]?.label}로 변경되었습니다.`);
      fetchAcademies();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to update");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 학원을 삭제하시겠습니까?`)) return;
    await handleStatusChange(id, "DELETED");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={24} className="text-purple-600" />
            학원 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">전체 {total}개 학원</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700"
        >
          <Plus size={16} />
          학원 추가
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-4">새 학원 등록</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">학원명 *</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="알파 피아노 학원"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">학원 코드 *</label>
                <input
                  value={createForm.code}
                  onChange={(e) => setCreateForm((p) => ({ ...p, code: e.target.value.toLowerCase() }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="alpha-piano (소문자, 숫자, - 만 가능)"
                  pattern="[a-z0-9-]+"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">학생 가입 시 사용할 고유 코드입니다</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-purple-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
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

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
        <div className="p-4 flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="학원명 또는 코드 검색"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">전체 상태</option>
            <option value="ACTIVE">활성</option>
            <option value="SUSPENDED">정지</option>
            <option value="DELETED">삭제</option>
          </select>
          <button
            onClick={fetchAcademies}
            className="border rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-purple-400" />
          </div>
        ) : academies.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p>등록된 학원이 없습니다.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="text-left px-6 py-3 font-medium">학원명</th>
                <th className="text-left px-6 py-3 font-medium">코드</th>
                <th className="text-left px-6 py-3 font-medium">사용자 수</th>
                <th className="text-left px-6 py-3 font-medium">상태</th>
                <th className="text-left px-6 py-3 font-medium">생성일</th>
                <th className="text-right px-6 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {academies.map((a) => {
                const sb = STATUS_BADGE[a.status];
                return (
                  <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{a.name}</td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-700">{a.code}</code>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{a._count?.users ?? 0}명</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sb?.cls}`}>
                        {sb?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(a.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {a.status === "ACTIVE" && (
                          <button
                            onClick={() => handleStatusChange(a.id, "SUSPENDED")}
                            title="정지"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                        {a.status === "SUSPENDED" && (
                          <button
                            onClick={() => handleStatusChange(a.id, "ACTIVE")}
                            title="활성화"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {a.status !== "DELETED" && (
                          <button
                            onClick={() => handleDelete(a.id, a.name)}
                            title="삭제"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
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
            >
              이전
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-500">
              {page} / {Math.ceil(total / 20)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / 20)}
              className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
