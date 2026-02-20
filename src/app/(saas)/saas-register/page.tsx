"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, GraduationCap, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function SaasRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    academyCode: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!/^(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
      toast.error("비밀번호는 대문자와 숫자를 포함해야 합니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/saas/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academyCode: form.academyCode.trim().toLowerCase(),
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: "STUDENT",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }
      // Store tokens and redirect
      localStorage.setItem("saas_access_token", data.data.accessToken);
      localStorage.setItem("saas_refresh_token", data.data.refreshToken);
      localStorage.setItem("saas_user", JSON.stringify(data.data.user));
      setSuccess(true);
      setTimeout(() => router.push("/academy-admin/users"), 2000);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">가입 완료!</h2>
          <p className="text-gray-500 mt-2">잠시 후 이동합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <GraduationCap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Academy SaaS</h1>
          <p className="text-gray-500 text-sm mt-1">학원 회원가입</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">회원가입</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Academy Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                학원 코드 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.academyCode}
                onChange={(e) => setForm((p) => ({ ...p, academyCode: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="alpha-piano (학원에서 제공한 코드)"
                required
                disabled={loading}
              />
              <p className="text-xs text-gray-400 mt-1">학원에서 제공한 고유 코드를 입력하세요</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="홍길동"
                required
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일 <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="student@example.com"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 <span className="text-red-500">*</span></label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="8자 이상, 대문자+숫자 포함"
                required
                disabled={loading}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 <span className="text-red-500">*</span></label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="비밀번호 재입력"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              가입하기
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            이미 계정이 있으신가요?{" "}
            <Link href="/saas-login" className="text-indigo-600 font-medium hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
