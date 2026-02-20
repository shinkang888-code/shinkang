"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      const role = data.user?.role ?? data.data?.role;
      toast.success("Login successful!");
      if (role === "SUPER_ADMIN") router.push("/super-admin/academies");
      else if (role === "ADMIN") router.push("/academy-admin/users");
      else router.push("/me");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email: string, pw: string) => {
    setForm({ email, password: pw });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Sign in to your account</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Sign In
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t">
        <p className="text-xs text-gray-400 font-medium mb-2 text-center">Quick login (dev)</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Super Admin", email: "super@saas.dev", pw: "SuperAdmin1234!" },
            { label: "Admin A", email: "admin@alpha.com", pw: "Admin1234!" },
            { label: "Teacher A", email: "teacher@alpha.com", pw: "Teacher1234!" },
            { label: "Student A", email: "student@alpha.com", pw: "Student1234!" },
          ].map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => quickLogin(acc.email, acc.pw)}
              className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 text-left"
            >
              <span className="font-medium">{acc.label}</span>
              <br />
              <span className="text-gray-400">{acc.email}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-brand-600 font-medium hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
