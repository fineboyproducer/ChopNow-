import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutClient />
    </Suspense>
  );
}
