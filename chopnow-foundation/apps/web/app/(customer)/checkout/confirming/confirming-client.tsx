"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@chopnow/ui";
import { apiFetch } from "@chopnow/lib";

interface OrderStatusResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // ~60 seconds before giving up and offering manual help

/**
 * Shown immediately after Paystack redirects the customer back from its
 * hosted checkout page. This page is deliberately NOT where payment gets
 * confirmed — Paystack's redirect only tells us the customer finished
 * the checkout flow on their end, not that the charge actually succeeded
 * (PRD Section 7.8). The real confirmation comes from the webhook
 * (app/api/webhooks/paystack/route.ts) landing in the database, usually
 * within a second or two. This page polls /api/orders/status until it
 * sees payment_status flip to "paid" (or "failed"), then routes
 * accordingly — so the customer never sees a false "success" based on
 * the redirect alone.
 */
export function ConfirmingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const [attempts, setAttempts] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!orderId) {
      setError("Missing order reference.");
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await apiFetch<OrderStatusResponse>(`/api/orders/status?orderId=${orderId}`);
        if (cancelled) return;

        if (data.paymentStatus === "paid") {
          router.replace(`/orders/${data.orderNumber}?justPlaced=1`);
          return;
        }
        if (data.paymentStatus === "failed") {
          router.replace(`/checkout?paymentFailed=1`);
          return;
        }
        // Still pending — keep polling up to the attempt limit.
        setAttempts((a) => a + 1);
      } catch {
        if (!cancelled) setAttempts((a) => a + 1);
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    poll(); // fire immediately rather than waiting for the first interval tick

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const timedOut = attempts >= MAX_POLL_ATTEMPTS;

  if (error) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="mb-4 text-destructive" size={32} />
        <p className="font-bold text-foreground">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-5" onClick={() => router.replace("/checkout")}>
          Back to checkout
        </Button>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="mb-4 text-warning" size={32} />
        <p className="font-bold text-foreground">Still confirming your payment</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This is taking longer than usual. Your payment may still go through — check your order
          history in a moment, or contact support with your order reference if you were charged.
        </p>
        <Button className="mt-5" onClick={() => router.replace("/account/orders")}>
          View my orders
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <Loader2 className="mb-4 animate-spin text-primary" size={32} />
      <p className="font-bold text-foreground">Confirming your payment...</p>
      <p className="mt-1 text-sm text-muted-foreground">This usually takes just a few seconds.</p>
    </div>
  );
}
