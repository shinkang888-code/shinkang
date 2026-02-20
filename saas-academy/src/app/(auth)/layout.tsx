// src/app/(auth)/layout.tsx
import { Toast } from "@/components/ui/Toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Toast>
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <span className="text-4xl">🎓</span>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Academy SaaS</h1>
            <p className="text-gray-500 text-sm mt-1">Multi-tenant Academy Management</p>
          </div>
          {children}
        </div>
      </div>
    </Toast>
  );
}
