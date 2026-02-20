"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface SaasUser {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
  academyId: string | null;
  academy?: { id: string; name: string; code: string; status: string } | null;
  status: string;
}

export function useSaasAuth(requiredRole?: string | string[]) {
  const router = useRouter();
  const [user, setUser] = useState<SaasUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const logout = useCallback(() => {
    const rt = localStorage.getItem("saas_refresh_token");
    if (rt) {
      fetch("/api/saas/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {});
    }
    localStorage.removeItem("saas_access_token");
    localStorage.removeItem("saas_refresh_token");
    localStorage.removeItem("saas_user");
    router.push("/saas-login");
  }, [router]);

  useEffect(() => {
    const at = localStorage.getItem("saas_access_token");
    const cached = localStorage.getItem("saas_user");

    if (!at || !cached) {
      router.push("/saas-login");
      return;
    }

    const u = JSON.parse(cached) as SaasUser;

    // Role check
    if (requiredRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!roles.includes(u.role)) {
        if (u.role === "SUPER_ADMIN") router.push("/super-admin/academies");
        else router.push("/academy-admin/users");
        return;
      }
    }

    setUser(u);
    setToken(at);
    setLoading(false);
  }, [router, requiredRole]);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const at = localStorage.getItem("saas_access_token");
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${at}`,
        },
      });
      // If 401, try refresh
      if (res.status === 401) {
        const rt = localStorage.getItem("saas_refresh_token");
        if (!rt) { logout(); return res; }
        const refreshRes = await fetch("/api/saas/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!refreshRes.ok) { logout(); return res; }
        const { data } = await refreshRes.json();
        localStorage.setItem("saas_access_token", data.accessToken);
        localStorage.setItem("saas_refresh_token", data.refreshToken);
        // Retry original request
        return fetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...(options.headers as Record<string, string>),
            Authorization: `Bearer ${data.accessToken}`,
          },
        });
      }
      return res;
    },
    [logout]
  );

  return { user, loading, token, authFetch, logout };
}
