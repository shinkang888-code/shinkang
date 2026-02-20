"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, Loader2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(2, "이름은 2자 이상"),
  email: z.string().email("올바른 이메일"),
  password: z.string().min(8, "비밀번호 8자 이상"),
  phone: z.string().optional(),
});

interface Teacher {
  id: string;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    isActive: boolean;
  };
}

export function TeachersClient({ studioId }: { studioId: string }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/teachers?studioId=${studioId}`);
      if (!res.ok) throw new Error("불러오기 실패");
      const { data } = await res.json();
      setTeachers(data);
    } catch {
      toast.error("선생님 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioId]);

  const handleCreate = async () => {
    const parsed = CreateSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((e) => {
        errs[e.path[0] as string] = e.message;
      });
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, studioId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "등록 실패");
      }
      toast.success("선생님이 등록되었습니다.");
      setDialogOpen(false);
      setForm({ name: "", email: "", password: "", phone: "" });
      fetchTeachers();
    } catch (e: unknown) {
      toast.error((e as Error).message || "등록 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (teacherId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("변경 실패");
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacherId ? { ...t, isActive } : t))
      );
      toast.success(isActive ? "활성화되었습니다." : "비활성화되었습니다.");
    } catch {
      toast.error("상태 변경 실패");
    }
  };

  const handleDelete = async (teacherId: string) => {
    if (!confirm("선생님을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제 실패");
      setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
      toast.success("삭제되었습니다.");
    } catch {
      toast.error("삭제 실패");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <p className="text-sm text-gray-500">총 {teachers.length}명</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserPlus size={15} />
              선생님 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>선생님 계정 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-sm font-medium mb-1 block">이름 *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="홍길동"
                />
                {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">이메일 *</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="teacher@example.com"
                />
                {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">비밀번호 *</label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="8자 이상"
                />
                {formErrors.password && <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">전화번호</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={submitting}
                className="w-full gap-2"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                {submitting ? "등록 중..." : "선생님 등록"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">등록된 선생님이 없습니다.</p>
          <p className="text-xs mt-1">위 버튼으로 추가하세요.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>등록일</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.user.name ?? "-"}</TableCell>
                <TableCell className="text-gray-600">{t.user.email}</TableCell>
                <TableCell className="text-gray-600">{t.user.phone ?? "-"}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      t.isActive
                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                    }
                  >
                    {t.isActive ? "활성" : "비활성"}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(t.createdAt).toLocaleDateString("ko-KR")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={t.isActive ? "text-gray-400 hover:text-orange-500" : "text-gray-400 hover:text-green-600"}
                      onClick={() => handleToggle(t.id, !t.isActive)}
                      title={t.isActive ? "비활성화" : "활성화"}
                    >
                      {t.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-gray-400 hover:text-red-600"
                      onClick={() => handleDelete(t.id)}
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
