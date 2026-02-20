"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("유효한 이메일을 입력하세요."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const doLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result) {
        toast.error("로그인 처리 중 오류가 발생했습니다.");
        return;
      }

      if (result.error) {
        toast.error("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      toast.success("로그인 성공!");

      // 역할별 리다이렉트: /api/me로 role 확인
      try {
        const meRes = await fetch("/api/me");
        if (meRes.ok) {
          const me = await meRes.json();
          if (me.role === "ADMIN") {
            router.push("/admin/dashboard");
          } else if (me.role === "TEACHER") {
            router.push("/teacher/dashboard");
          } else {
            router.push("/student/dashboard");
          }
          router.refresh();
          return;
        }
      } catch (e) {
        console.error("Failed to fetch /api/me:", e);
      }
      
      // fallback
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    await doLogin(data.email, data.password);
  };

  return (
    <Card className="shadow-xl border-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl text-center">로그인</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="admin@piano-academy.com"
                      autoComplete="email"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비밀번호</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPw ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={isLoading}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  로그인 중...
                </>
              ) : (
                "로그인"
              )}
            </Button>
          </form>
        </Form>

        {/* 테스트 계정 빠른 접속 */}
        <div className="space-y-2">
          <p className="text-xs text-center text-gray-400 font-medium">빠른 테스트 로그인</p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={isLoading}
              onClick={() => doLogin("admin@piano-academy.com", "Admin1234!")}
            >
              🏫 관리자
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={isLoading}
              onClick={() => doLogin("teacher1@test.com", "Teacher1234!")}
            >
              👩‍🏫 선생님
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={isLoading}
              onClick={() => doLogin("student1@test.com", "Student1234!")}
            >
              🎹 원생
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">또는</span>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600">
          계정이 없으신가요?{" "}
          <Link
            href="/register"
            className="text-indigo-600 hover:underline font-medium"
          >
            학원 등록하기
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
