"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export default function SaasLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/saas/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }
      // Store tokens
      localStorage.setItem("saas_access_token", data.data.accessToken);
      localStorage.setItem("saas_refresh_token", data.data.refreshToken);
      localStorage.setItem("saas_user", JSON.stringify(data.data.user));

      const role = data.data.user.role;
      if (role === "SUPER_ADMIN") {
        router.push("/super-admin/academies");
      } else {
        router.push("/academy-admin/users");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (email: string, pw: string) => {
    setForm({ email, password: pw });
    setLoading(true);
    try {
      const res = await fetch("/api/saas/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Login failed"); return; }
      localStorage.setItem("saas_access_token", data.data.accessToken);
      localStorage.setItem("saas_refresh_token", data.data.refreshToken);
      localStorage.setItem("saas_user", JSON.stringify(data.data.user));
      const role = data.data.user.role;
      if (role === "SUPER_ADMIN") router.push("/super-admin/academies");
      else router.push("/academy-admin/users");
    } catch { toast.error("Network error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <GraduationCap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Academy SaaS</h1>
          <p className="text-gray-500 text-sm mt-1">학원 관리 플랫폼</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="email@example.com"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              로그인
            </button>
          </form>

          {/* Quick Login Buttons */}
          <div className="mt-6">
            <p className="text-xs text-center text-gray-400 mb-3 font-medium">빠른 테스트 로그인</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => quickLogin("super@saas.com", "Super1234!")}
                disabled={loading}
                className="text-xs py-1.5 px-2 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
              >
                🔐 슈퍼어드민
              </button>
              <button
                onClick={() => quickLogin("admin@alpha.com", "Admin1234!")}
                disabled={loading}
                className="text-xs py-1.5 px-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                🏫 학원관리자
              </button>
              <button
                onClick={() => quickLogin("student@alpha.com", "Student1234!")}
                disabled={loading}
                className="text-xs py-1.5 px-2 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                🎹 원생
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            계정이 없으신가요?{" "}
            <Link href="/saas-register" className="text-indigo-600 font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
