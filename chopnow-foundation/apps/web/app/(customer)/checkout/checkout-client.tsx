"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Home,
  Phone,
  CreditCard,
  PackageCheck,
  Check,
  Clock,
  ShieldCheck,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { Button, Card, EmptyState } from "@chopnow/ui";
import { cn, formatNaira } from "@chopnow/lib";
import { useCart } from "@/lib/cart/cart-context";
import { createOrderAction } from "@/lib/actions/orders";
import { listAddresses } from "@/lib/actions/addresses";
import type { Address } from "@chopnow/types";

const PAYMENT_METHODS = [
  {
    id: "paystack",
    label: "Pay with Paystack",
    sub: "Card, bank transfer or USSD",
    icon: CreditCard,
  },
  {
    id: "cash",
    label: "Cash on delivery",
    sub: "Pay the rider when your order arrives",
    icon: PackageCheck,
  },
] as const;

export function CheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, displayPrice, subtotal, deliveryFee, serviceFee, total, clear } = useCart();

  const [addresses, setAddresses] = React.useState<Address[] | null>(null);
  const [addressesError, setAddressesError] = React.useState<string | null>(null);
  const [addressId, setAddressId] = React.useState<string | null>(null);
  const [phone, setPhone] = React.useState("");
  const [payment, setPayment] = React.useState<(typeof PAYMENT_METHODS)[number]["id"]>("paystack");
  const [placing, setPlacing] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const paymentFailedNotice = searchParams.get("paymentFailed") === "1";

  React.useEffect(() => {
    let cancelled = false;
    listAddresses().then((res) => {
      if (cancelled) return;
      if (res.success) {
        setAddresses(res.data);
        const defaultAddr = res.data.find((a) => a.isDefault) ?? res.data[0];
        if (defaultAddr) setAddressId(defaultAddr.id);
      } else {
        setAddressesError(res.error.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlaceOrder = async () => {
    if (!state.restaurantId) return;
    setSubmitError(null);
    setPlacing(true);

    const result = await createOrderAction({
      restaurantId: state.restaurantId,
      lines: state.lines.map((l) => ({
        menuItemId: l.itemId,
        quantity: l.qty,
        specialInstructions: l.notes || undefined,
      })),
      deliveryAddressId: addressId ?? undefined,
      deliveryPhone: phone,
      paymentMethod: payment,
    });

    if (!result.success) {
      setPlacing(false);
      setSubmitError(result.error.message);
      return;
    }

    if (result.data.paymentMethod === "paystack" && result.data.paymentCheckoutUrl) {
      // Cart is cleared once payment is actually confirmed (the webhook
      // path), not here — clearing now would lose the order details if
      // the customer abandons the Paystack page and comes back. Instead
      // clear happens when the confirming page routes to the order page.
      window.location.href = result.data.paymentCheckoutUrl;
      return;
    }

    // Cash on delivery: no payment gateway redirect needed, order is
    // already in restaurant_notified status.
    clear();
    router.push(`/orders/${result.data.orderNumber}?justPlaced=1`);
  };

  if (state.lines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <EmptyState
          title="Your cart is empty"
          description="Add items from a restaurant before checking out."
          action={
            <Button asChild>
              <Link href="/discover">Browse restaurants</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-40 pt-6 md:px-10">
      <Link href="/discover" className="mb-5 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
        <ChevronLeft size={16} /> Back to cart
      </Link>
      <h1 className="mb-6 text-2xl font-black tracking-tight text-foreground">Checkout</h1>

      {paymentFailedNotice && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5">
          <AlertTriangle size={16} className="shrink-0 text-destructive" />
          <p className="text-[12.5px] text-destructive">
            Your last payment attempt didn&apos;t go through. No charge was made — please try again.
          </p>
        </div>
      )}

      <div className="space-y-5">
        <Card className="p-4">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Delivery address
          </p>

          {addressesError && (
            <p className="mb-2 text-[12px] text-destructive">{addressesError}</p>
          )}

          <div className="space-y-2">
            {addresses === null && !addressesError && (
              <p className="text-[12.5px] text-muted-foreground">Loading your addresses...</p>
            )}

            {addresses?.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground">
                You have no saved addresses yet.
              </p>
            )}

            {addresses?.map((a) => (
              <button
                key={a.id}
                onClick={() => setAddressId(a.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors",
                  addressId === a.id ? "border-primary bg-accent" : "border-border",
                )}
              >
                <Home size={16} className="shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-foreground">{a.label || "Address"}</p>
                  <p className="text-[11.5px] text-muted-foreground">{a.fullAddress}</p>
                </div>
                {addressId === a.id && <Check size={16} className="text-primary" />}
              </button>
            ))}

            <Link
              href="/account/addresses"
              className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-border p-3 text-left text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus size={16} className="shrink-0" />
              <span className="text-[13px] font-bold">Add a new address</span>
            </Link>
          </div>

          <div className="mt-3">
            <label htmlFor="phone" className="mb-1 block text-[11px] font-bold text-muted-foreground">
              Phone number
            </label>
            <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
              <Phone size={15} className="text-muted-foreground" />
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08031234567"
                className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Payment method
          </p>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPayment(p.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors",
                  payment === p.id ? "border-primary bg-accent" : "border-border",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    payment === p.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <p.icon size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-foreground">{p.label}</p>
                  <p className="text-[11px] text-muted-foreground">{p.sub}</p>
                </div>
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    payment === p.id ? "border-primary" : "border-border",
                  )}
                >
                  {payment === p.id && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Order summary
          </p>
          <div className="space-y-2">
            {state.lines.map((line) => (
              <div key={line.itemId} className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">
                  {line.qty}× {line.name}
                </span>
                <span className="font-semibold text-foreground">
                  {formatNaira(displayPrice(line) * line.qty)}
                </span>
              </div>
            ))}
            <div className="mt-2 space-y-1.5 border-t border-dashed border-border pt-2">
              <div className="flex justify-between text-[13px] text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatNaira(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-muted-foreground">
                <span>Delivery fee</span>
                <span>{formatNaira(deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-muted-foreground">
                <span>Service fee</span>
                <span>{formatNaira(serviceFee)}</span>
              </div>
              <div className="flex justify-between pt-1 text-[16px] font-extrabold">
                <span>Total</span>
                <span className="text-primary">{formatNaira(total)}</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-2.5 rounded-xl bg-accent p-3.5">
          <Clock size={16} className="shrink-0 text-primary" />
          <p className="text-[12.5px] text-foreground/80">
            Estimated delivery: <span className="font-bold text-foreground">30–40 minutes</span>{" "}
            after your order is confirmed.
          </p>
        </div>

        <div className="flex items-center justify-center gap-5 text-[11px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1">
            <ShieldCheck size={13} className="text-success" /> Secure checkout
          </span>
          <span className="flex items-center gap-1">
            <Check size={13} className="text-success" /> Verified restaurant
          </span>
        </div>

        {submitError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-center">
            <p className="text-[13px] font-medium text-destructive">{submitError}</p>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-50 border-t border-border bg-background p-4 md:bottom-0">
        <div className="mx-auto max-w-2xl">
          <Button
            onClick={handlePlaceOrder}
            disabled={placing || !phone || !addressId}
            className="w-full py-4 text-[15px]"
          >
            {placing ? "Placing order..." : `Place Order · ${formatNaira(total)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
