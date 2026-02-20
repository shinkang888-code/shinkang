"use client";
/**
 * /academy-admin/students/[studentId]/contacts
 *
 * Page: manage parent/guardian contacts for a specific student.
 * Features:
 *  - List all contacts (name, phone, relationship, opt-in status)
 *  - Add new contact modal
 *  - Edit/delete existing contacts
 *  - Toggle notificationOptIn with consent timestamp
 */

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Input, Modal, Spinner, Badge } from "@/components/ui";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────

type Relationship = "MOTHER" | "FATHER" | "GUARDIAN" | "ETC";
type ContactStatus = "ACTIVE" | "INACTIVE";

interface ParentContact {
  id:                 string;
  studentUserId:      string;
  name:               string;
  phone:              string;
  relationship:       Relationship;
  notificationOptIn:  boolean;
  consentRecordedAt:  string | null;
  preferredLanguage:  string;
  status:             ContactStatus;
  createdAt:          string;
}

interface FormState {
  name:              string;
  phone:             string;
  relationship:      Relationship;
  notificationOptIn: boolean;
  preferredLanguage: string;
}

const DEFAULT_FORM: FormState = {
  name:              "",
  phone:             "",
  relationship:      "ETC",
  notificationOptIn: false,
  preferredLanguage: "KO",
};

const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  MOTHER:   "어머니",
  FATHER:   "아버지",
  GUARDIAN: "보호자",
  ETC:      "기타",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function StudentContactsPage() {
  const params                            = useParams();
  const studentId                         = params.studentId as string;
  const [contacts, setContacts]           = useState<ParentContact[]>([]);
  const [loading,  setLoading]            = useState(true);
  const [showAdd,  setShowAdd]            = useState(false);
  const [editContact, setEditContact]     = useState<ParentContact | null>(null);
  const [form,     setForm]               = useState<FormState>(DEFAULT_FORM);
  const [saving,   setSaving]             = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/academy/parent-contacts?studentUserId=${studentId}`,
      );
      if (!res.ok) throw new Error("조회 실패");
      const { data } = await res.json();
      setContacts(data);
    } catch {
      toast.error("연락처 조회에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // ── Open modals ────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(DEFAULT_FORM);
    setEditContact(null);
    setShowAdd(true);
  }

  function openEdit(contact: ParentContact) {
    setForm({
      name:              contact.name,
      phone:             contact.phone,
      relationship:      contact.relationship,
      notificationOptIn: contact.notificationOptIn,
      preferredLanguage: contact.preferredLanguage,
    });
    setEditContact(contact);
    setShowAdd(true);
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      if (!form.name.trim() || !form.phone.trim()) {
        toast.error("이름과 전화번호를 입력해주세요");
        return;
      }

      if (editContact) {
        const res = await fetch(`/api/academy/parent-contacts/${editContact.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(form),
        });
        if (!res.ok) throw new Error("수정 실패");
        toast.success("연락처가 수정되었습니다");
      } else {
        const res = await fetch("/api/academy/parent-contacts", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ ...form, studentUserId: studentId }),
        });
        if (!res.ok) throw new Error("추가 실패");
        toast.success("연락처가 추가되었습니다");
      }

      setShowAdd(false);
      await fetchContacts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/academy/parent-contacts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제 실패");
      toast.success("연락처가 삭제되었습니다");
      setDeleteConfirm(null);
      await fetchContacts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류 발생");
    }
  }

  // ── Toggle opt-in ──────────────────────────────────────────────────────────

  async function toggleOptIn(contact: ParentContact) {
    try {
      const res = await fetch(`/api/academy/parent-contacts/${contact.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ notificationOptIn: !contact.notificationOptIn }),
      });
      if (!res.ok) throw new Error("수정 실패");
      toast.success(
        contact.notificationOptIn ? "알림 수신을 해제했습니다" : "알림 수신에 동의했습니다",
      );
      await fetchContacts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류 발생");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">학부모 연락처 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            학생의 학부모/보호자 연락처를 관리하고 알림 수신 동의를 설정합니다.
          </p>
        </div>
        <Button onClick={openAdd}>+ 연락처 추가</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Spinner />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center text-gray-400 py-16 border border-dashed border-gray-200 rounded-lg">
          등록된 연락처가 없습니다.
          <br />
          <button onClick={openAdd} className="text-brand-500 mt-2 text-sm hover:underline">
            첫 번째 연락처 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              className={`bg-white rounded-lg border p-4 flex items-start justify-between gap-4 ${
                c.status === "INACTIVE" ? "opacity-50" : "border-gray-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  <Badge variant="role">{RELATIONSHIP_LABEL[c.relationship]}</Badge>
                  {c.status === "INACTIVE" && (
                    <Badge variant="suspended">비활성</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{c.phone}</p>
                {c.consentRecordedAt && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ 알림 동의:{" "}
                    {new Date(c.consentRecordedAt).toLocaleDateString("ko-KR")}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Opt-in toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.notificationOptIn}
                    onClick={() => toggleOptIn(c)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      c.notificationOptIn ? "bg-brand-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        c.notificationOptIn ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  알림
                </label>

                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                  수정
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setDeleteConfirm(c.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      {showAdd && (
        <Modal
          open={showAdd}
          title={editContact ? "연락처 수정" : "연락처 추가"}
          onClose={() => setShowAdd(false)}
        >
          <div className="space-y-4 p-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
              <Input
                placeholder="홍길동"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                휴대폰 번호 *
              </label>
              <Input
                placeholder="01012345678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">숫자만 입력 (하이픈 제외)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">관계</label>
              <select
                value={form.relationship}
                onChange={(e) =>
                  setForm({ ...form, relationship: e.target.value as Relationship })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {Object.entries(RELATIONSHIP_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.notificationOptIn}
                onChange={(e) =>
                  setForm({ ...form, notificationOptIn: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm text-gray-700">
                카카오 알림톡 수신 동의
              </span>
            </label>
            {form.notificationOptIn && (
              <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded">
                저장 시 현재 시각으로 동의 시각이 기록됩니다.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                취소
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "저장 중…" : "저장"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────────────── */}
      {deleteConfirm && (
        <Modal open={!!deleteConfirm} title="연락처 삭제" onClose={() => setDeleteConfirm(null)}>
          <div className="space-y-4 p-1">
            <p className="text-sm text-gray-600">
              이 연락처를 삭제하면 향후 알림이 발송되지 않습니다. 계속하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
                취소
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDelete(deleteConfirm)}
              >
                삭제
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
