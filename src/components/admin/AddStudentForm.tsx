"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "이름을 입력하세요."),
  email: z.string().email("유효한 이메일을 입력하세요."),
  phone: z.string().optional(),
  grade: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  memo: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  studioId: string;
  onSuccess: () => void;
}

export function AddStudentForm({ studioId, onSuccess }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", email: "", phone: "", grade: "",
      parentName: "", parentPhone: "", memo: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, studioId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "원생 등록 실패");
        return;
      }
      toast.success("원생이 등록되었습니다.");
      onSuccess();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>이름 *</FormLabel>
              <FormControl><Input placeholder="홍길동" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>이메일 *</FormLabel>
              <FormControl><Input type="email" placeholder="student@example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>연락처</FormLabel>
              <FormControl><Input placeholder="010-0000-0000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="grade" render={({ field }) => (
            <FormItem>
              <FormLabel>학년/레벨</FormLabel>
              <FormControl><Input placeholder="초등 3학년 / 중급" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="parentName" render={({ field }) => (
            <FormItem>
              <FormLabel>보호자 이름</FormLabel>
              <FormControl><Input placeholder="보호자 성함" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="parentPhone" render={({ field }) => (
            <FormItem>
              <FormLabel>보호자 연락처</FormLabel>
              <FormControl><Input placeholder="010-0000-0000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="memo" render={({ field }) => (
          <FormItem>
            <FormLabel>메모</FormLabel>
            <FormControl>
              <Input placeholder="특이사항 등" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />등록 중...</> : "원생 등록"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
