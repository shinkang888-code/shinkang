"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    academyCode: "",
    inviteToken,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm((p) => ({ ...p, inviteToken: searchParams.get("invite") ?? "" }));
  }, [searchParams]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name || form.name.length < 2) e.name = "Name must be at least 2 characters";
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
    if (!form.password || form.password.length < 8) e.password = "Min 8 characters";
    if (!/[A-Z]/.test(form.password)) e.password = "Password needs uppercase";
    if (!/[0-9]/.test(form.password)) e.password = "Password needs a number";
    if (!form.inviteToken && !form.academyCode) e.academyCode = "Academy code or invite token required";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});
    try {
      const payload: Record<string, string> = {
        name: form.name,
        email: form.email,
        password: form.password,
      };
      if (form.inviteToken) payload.inviteToken = form.inviteToken;
      else payload.academyCode = form.academyCode;

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ form: data.error ?? "Registration failed" });
        return;
      }
      toast.success("Account created! Redirecting...");
      const role = data.data?.role ?? data.user?.role;
      setTimeout(() => {
        if (role === "ADMIN") router.push("/academy-admin");
        else router.push("/me");
      }, 800);
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Create your account</h2>
      <p className="text-sm text-gray-500 mb-6">
        {form.inviteToken ? "You have an invite — fill in your details below." : "Enter an academy code to join as a student."}
      </p>

      {errors.form && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {errors.form}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Jane Doe" error={errors.name} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" error={errors.email} />
        <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="••••••••" hint="Min 8 chars, one uppercase, one number" error={errors.password} />

        {form.inviteToken ? (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            🎫 Invite token applied. You will be registered with the invited role.
          </div>
        ) : (
          <Input
            label="Academy Code"
            value={form.academyCode}
            onChange={(e) => setForm((p) => ({ ...p, academyCode: e.target.value }))}
            placeholder="alpha-academy"
            hint="Ask your academy admin for the code"
            error={errors.academyCode}
          />
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 rounded-full border-4 border-brand-600 border-t-transparent" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}
