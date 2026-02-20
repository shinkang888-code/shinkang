"use client";
/**
 * /me/billing – Student billing overview page.
 *
 * Shows:
 *  1. Active subscription status & next billing date.
 *  2. Current payment method (last4, card brand).
 *  3. Button to register / update payment card via Toss.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

interface Subscription {
  id: string;
  status: string;
  nextBillingDate: string;
  plan: { name: string; amount: number };
}

interface PaymentMethod {
  id: string;
  last4: string | null;
  cardBrand: string | null;
  status: string;
}

export default function StudentBillingPage() {
  const { push: toast } = useToast();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [pm, setPm] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Fetch own subscription (most recent active)
      const [sr, pmr] = await Promise.allSettled([
        fetch("/api/me/subscription"),
        fetch("/api/me/payment-method"),
      ]);
      if (sr.status === "fulfilled" && sr.value.ok) {
        const { data } = await sr.value.json();
        setSub(data ?? null);
      }
      if (pmr.status === "fulfilled" && pmr.value.ok) {
        const { data } = await pmr.value.json();
        setPm(data ?? null);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleRegisterCard() {
    setInitiating(true);
    try {
      const origin     = window.location.origin;
      const successUrl = `${origin}/me/billing/toss-success`;
      const failUrl    = `${origin}/me/billing/toss-fail`;

      const res = await fetch("/api/me/payment-methods/toss", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ successUrl, failUrl }),
      });
      if (!res.ok) {
        const b = await res.json();
        toast(b.error ?? "Failed to initiate card registration", "error");
        return;
      }
      const { data } = await res.json();

      // Load Toss JS SDK and open billing auth widget
      const tossPayments = (window as unknown as Record<string, unknown>).TossPayments;
      if (!tossPayments) {
        toast("Toss Payments SDK not loaded", "error");
        return;
      }
      const client = (tossPayments as (key: string) => { requestBillingAuth: (p: unknown) => Promise<void> })(data.clientKey);
      await client.requestBillingAuth({
        method:      "CARD",
        customerKey: data.customerKey,
        successUrl:  data.successUrl,
        failUrl:     data.failUrl,
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setInitiating(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading billing info…</div>;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your subscription and payment method</p>
      </div>

      {/* Subscription card */}
      <div className="rounded-lg border border-gray-200 p-6 space-y-3 bg-white shadow-sm">
        <h2 className="font-semibold text-gray-800">Subscription</h2>
        {sub ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{sub.plan.name}</span>
              <Badge variant={sub.status === "ACTIVE" ? "active" : "suspended"}>{sub.status}</Badge>
            </div>
            <p className="text-sm text-gray-600">
              Monthly amount: <strong>₩{sub.plan.amount.toLocaleString()}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Next billing: <strong>{sub.nextBillingDate?.slice(0, 10) ?? "—"}</strong>
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">No active subscription. Contact your academy admin.</p>
        )}
      </div>

      {/* Payment method card */}
      <div className="rounded-lg border border-gray-200 p-6 space-y-3 bg-white shadow-sm">
        <h2 className="font-semibold text-gray-800">Payment Method</h2>
        {pm ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {pm.cardBrand ?? "Card"} ···· {pm.last4 ?? "****"}
            </span>
            <Badge variant={pm.status === "ACTIVE" ? "active" : "suspended"}>{pm.status}</Badge>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No payment method registered.</p>
        )}
        <Button onClick={handleRegisterCard} disabled={initiating} variant="secondary" className="w-full">
          {initiating ? "Opening Toss…" : pm ? "Update Card" : "Register Card (Toss)"}
        </Button>
        <p className="text-xs text-gray-400">
          You will be redirected to Toss Payments to securely register your card.
        </p>
      </div>

      {/* Link to invoice history */}
      <a href="/me/invoices" className="block text-sm text-brand-600 hover:underline">
        View invoice history →
      </a>

      {/* Toss SDK – loaded dynamically */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://js.tosspayments.com/v1/payment" />
    </div>
  );
}
