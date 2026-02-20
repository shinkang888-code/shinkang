"use client";
/**
 * /academy-admin/notifications
 *
 * Page: AlimTalk notification settings + template management for academy admin.
 * Two tabs:
 *  1. "알림 설정"  – toggle flags, quiet hours
 *  2. "템플릿 관리" – register ABSENT / LATE / EXCUSED template codes
 */

import React, { useEffect, useState } from "react";
import { Button, Input, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface NotificationSettings {
  alimtalkEnabled:           boolean;
  sendOnAbsent:              boolean;
  sendOnLate:                boolean;
  sendOnExcused:             boolean;
  allowResendOnStatusChange: boolean;
  quietHoursEnabled:         boolean;
  quietHoursStart:           string;
  quietHoursEnd:             string;
}

interface AlimtalkTemplate {
  id:           string;
  type:         "ABSENT" | "LATE" | "EXCUSED";
  templateCode: string;
  senderKey:    string;
  isActive:     boolean;
}

const TEMPLATE_TYPES: Array<{ type: AlimtalkTemplate["type"]; label: string; description: string }> = [
  { type: "ABSENT",  label: "결석",  description: "학생이 결석했을 때 발송" },
  { type: "LATE",    label: "지각",  description: "학생이 지각했을 때 발송" },
  { type: "EXCUSED", label: "공결",  description: "학생이 공결 처리됐을 때 발송 (선택적)" },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const [activeTab, setActiveTab] = useState<"settings" | "templates">("settings");
  const [loading,  setLoading]    = useState(true);

  // Settings state
  const [settings, setSettings] = useState<NotificationSettings>({
    alimtalkEnabled:           false,
    sendOnAbsent:              true,
    sendOnLate:                true,
    sendOnExcused:             false,
    allowResendOnStatusChange: false,
    quietHoursEnabled:         true,
    quietHoursStart:           "21:00",
    quietHoursEnd:             "08:00",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Templates state
  const [templates,     setTemplates]     = useState<Record<string, AlimtalkTemplate>>({});
  const [templateInput, setTemplateInput] = useState<
    Record<string, { templateCode: string; senderKey: string; isActive: boolean }>
  >({
    ABSENT:  { templateCode: "", senderKey: "", isActive: true },
    LATE:    { templateCode: "", senderKey: "", isActive: true },
    EXCUSED: { templateCode: "", senderKey: "", isActive: true },
  });
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [sRes, tRes] = await Promise.all([
        fetch("/api/academy/notification-settings"),
        fetch("/api/academy/alimtalk-templates"),
      ]);

      if (sRes.ok) {
        const { data } = await sRes.json();
        setSettings(data);
      }

      if (tRes.ok) {
        const { data } = await tRes.json();
        const map: Record<string, AlimtalkTemplate> = {};
        const inp = { ...templateInput };
        for (const t of data as AlimtalkTemplate[]) {
          map[t.type] = t;
          inp[t.type] = { templateCode: t.templateCode, senderKey: t.senderKey, isActive: t.isActive };
        }
        setTemplates(map);
        setTemplateInput(inp);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Save settings ──────────────────────────────────────────────────────────

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/academy/notification-settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("저장 실패");
      toast.success("알림 설정이 저장되었습니다");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setSavingSettings(false);
    }
  }

  // ── Save template ──────────────────────────────────────────────────────────

  async function saveTemplate(type: AlimtalkTemplate["type"]) {
    setSavingTemplate(type);
    try {
      const inp = templateInput[type];
      if (!inp.templateCode || !inp.senderKey) {
        toast.error("템플릿 코드와 발신키를 입력해주세요");
        return;
      }
      const res = await fetch("/api/academy/alimtalk-templates", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, ...inp }),
      });
      if (!res.ok) throw new Error("저장 실패");
      toast.success(`${TEMPLATE_TYPES.find((t) => t.type === type)?.label} 템플릿 저장됨`);
      await fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setSavingTemplate(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">카카오 알림톡 설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          출결 알림을 학부모에게 자동 발송하는 카카오 알림톡을 설정합니다.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "settings",  label: "알림 설정"  },
          { key: "templates", label: "템플릿 관리" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Settings ───────────────────────────────────────────────── */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* Master toggle */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <ToggleRow
              label="알림톡 발송 활성화"
              description="비활성화 시 모든 알림 발송이 중단됩니다"
              checked={settings.alimtalkEnabled}
              onChange={(v) => setSettings({ ...settings, alimtalkEnabled: v })}
              highlight
            />
          </div>

          {/* Policy toggles */}
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">발송 조건</h3>
              <div className="space-y-3">
                <ToggleRow
                  label="결석 시 발송"
                  description="학생이 결석으로 처리될 때 학부모에게 알림"
                  checked={settings.sendOnAbsent}
                  onChange={(v) => setSettings({ ...settings, sendOnAbsent: v })}
                />
                <ToggleRow
                  label="지각 시 발송"
                  description="학생이 지각으로 처리될 때 학부모에게 알림"
                  checked={settings.sendOnLate}
                  onChange={(v) => setSettings({ ...settings, sendOnLate: v })}
                />
                <ToggleRow
                  label="공결 시 발송"
                  description="학생이 공결 처리될 때 학부모에게 알림 (기본 비활성)"
                  checked={settings.sendOnExcused}
                  onChange={(v) => setSettings({ ...settings, sendOnExcused: v })}
                />
                <ToggleRow
                  label="상태 변경 시 재발송 허용"
                  description="예: 결석→지각으로 변경 시 추가 알림 발송"
                  checked={settings.allowResendOnStatusChange}
                  onChange={(v) => setSettings({ ...settings, allowResendOnStatusChange: v })}
                />
              </div>
            </div>

            {/* Quiet hours */}
            <div className="p-5 space-y-4">
              <ToggleRow
                label="야간 발송 제한"
                description="설정된 시간대에는 메시지를 대기열에 보관하다가 이후에 발송"
                checked={settings.quietHoursEnabled}
                onChange={(v) => setSettings({ ...settings, quietHoursEnabled: v })}
              />
              {settings.quietHoursEnabled && (
                <div className="flex items-center gap-4 ml-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">발송 제한 시작</label>
                    <Input
                      type="time"
                      value={settings.quietHoursStart}
                      onChange={(e) =>
                        setSettings({ ...settings, quietHoursStart: e.target.value })
                      }
                      className="w-32"
                    />
                  </div>
                  <span className="text-gray-400 mt-4">~</span>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">발송 제한 종료</label>
                    <Input
                      type="time"
                      value={settings.quietHoursEnd}
                      onChange={(e) =>
                        setSettings({ ...settings, quietHoursEnd: e.target.value })
                      }
                      className="w-32"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? "저장 중…" : "설정 저장"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Tab 2: Templates ──────────────────────────────────────────────── */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            카카오 비즈메시지 포털에서 등록한 템플릿 코드와 발신 채널 키를 입력하세요.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>템플릿 변수:</strong>{" "}
            #{"{academyName}"} #{"{studentName}"} #{"{className}"} #{"{sessionDate}"}
            #{"{sessionTime}"} #{"{statusText}"} #{"{teacherName}"}
          </div>

          {TEMPLATE_TYPES.map(({ type, label, description }) => {
            const inp = templateInput[type];
            const saved = templates[type];
            return (
              <div
                key={type}
                className="bg-white rounded-lg border border-gray-200 p-5 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold mr-2 ${
                          type === "ABSENT"
                            ? "bg-red-100 text-red-700"
                            : type === "LATE"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {label}
                      </span>
                      {description}
                    </h3>
                    {saved && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ 등록됨: {saved.templateCode} · {saved.isActive ? "활성" : "비활성"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      템플릿 코드
                    </label>
                    <Input
                      placeholder="예: TM_ABSENT_001"
                      value={inp.templateCode}
                      onChange={(e) =>
                        setTemplateInput({
                          ...templateInput,
                          [type]: { ...inp, templateCode: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      채널 발신키 (Sender Key)
                    </label>
                    <Input
                      placeholder="예: abc123def456..."
                      value={inp.senderKey}
                      onChange={(e) =>
                        setTemplateInput({
                          ...templateInput,
                          [type]: { ...inp, senderKey: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inp.isActive}
                      onChange={(e) =>
                        setTemplateInput({
                          ...templateInput,
                          [type]: { ...inp, isActive: e.target.checked },
                        })
                      }
                      className="rounded"
                    />
                    활성화
                  </label>
                  <Button
                    size="sm"
                    onClick={() => saveTemplate(type)}
                    disabled={savingTemplate === type}
                  >
                    {savingTemplate === type ? "저장 중…" : "저장"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sub-component: Toggle row ─────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  highlight = false,
}: {
  label:       string;
  description: string;
  checked:     boolean;
  onChange:    (v: boolean) => void;
  highlight?:  boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div>
        <p className={`text-sm font-medium ${highlight ? "text-gray-900" : "text-gray-700"}`}>
          {label}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0 mt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 ${
            checked ? "bg-brand-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </label>
  );
}
