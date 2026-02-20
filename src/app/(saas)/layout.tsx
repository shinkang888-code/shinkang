import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Academy SaaS",
};

export default function SaasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {children}
    </div>
  );
}
