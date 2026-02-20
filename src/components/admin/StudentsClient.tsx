"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Search, Phone, Mail, Music } from "lucide-react";
import type { StudentDTO } from "@/types";
import { AddStudentForm } from "./AddStudentForm";

interface Props { studioId: string }

export function StudentsClient({ studioId }: Props) {
  const [students, setStudents] = useState<StudentDTO[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchStudents = () => {
    setLoading(true);
    fetch(`/api/admin/students?studioId=${studioId}`)
      .then((r) => r.json())
      .then((j) => setStudents(j.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStudents(); }, [studioId]);

  const filtered = students.filter((s) =>
    [s.user.name, s.user.email, s.grade].some(
      (v) => v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const handleDeactivate = async (studentId: string) => {
    if (!confirm("원생을 비활성화하시겠습니까?")) return;
    const res = await fetch(`/api/admin/students/${studentId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("원생이 비활성화되었습니다.");
      fetchStudents();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">원생 관리</h1>
          <p className="text-sm text-gray-500 mt-1">등록된 원생 {students.length}명</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus size={16} className="mr-2" />
              원생 등록
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>원생 등록</DialogTitle>
            </DialogHeader>
            <AddStudentForm
              studioId={studioId}
              onSuccess={() => { setOpen(false); fetchStudents(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="이름, 이메일, 학년으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>이름</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>학년/레벨</TableHead>
                <TableHead>보호자</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    등록된 원생이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((student) => (
                  <TableRow key={student.id} className="hover:bg-gray-50/50">
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{student.user.name}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <Mail size={11} />
                          {student.user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.user.phone ? (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone size={12} />
                          {student.user.phone}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700">{student.grade ?? "-"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-gray-700">{student.parentName ?? "-"}</p>
                        {student.parentPhone && (
                          <p className="text-xs text-gray-400">{student.parentPhone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.isActive ? "default" : "secondary"}>
                        {student.isActive ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(student.enrolledAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/admin/students/${student.id}/practice`} className="flex items-center gap-1">
                            <Music size={12} />
                            연습
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/admin/students/${student.id}`}>상세</a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeactivate(student.id)}
                        >
                          비활성화
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
