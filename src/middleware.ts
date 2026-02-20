import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 공개 경로 (인증 불필요)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

  const token = await getToken({
    req,
    secret,
    cookieName: "authjs.session-token",
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string | undefined;

  // 관리자 전용 경로
  if (pathname.startsWith("/admin")) {
    if (role !== "ADMIN") {
      if (role === "TEACHER") {
        return NextResponse.redirect(new URL("/teacher/dashboard", req.url));
      }
      return NextResponse.redirect(new URL("/student/dashboard", req.url));
    }
  }

  // 선생님 전용 경로
  if (pathname.startsWith("/teacher")) {
    if (role !== "TEACHER") {
      if (role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      }
      return NextResponse.redirect(new URL("/student/dashboard", req.url));
    }
  }

  // 원생 전용 경로
  if (pathname.startsWith("/student")) {
    if (role !== "STUDENT") {
      if (role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      }
      if (role === "TEACHER") {
        return NextResponse.redirect(new URL("/teacher/dashboard", req.url));
      }
    }
  }

  // API 경로 보호 - teacher API
  if (pathname.startsWith("/api/teacher") && role !== "TEACHER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
