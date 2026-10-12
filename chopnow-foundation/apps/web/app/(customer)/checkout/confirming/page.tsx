import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ConfirmingClient } from "./confirming-client";

export const metadata: Metadata = { title: "Confirming your order" };

export default function ConfirmingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <Loader2 className="mb-4 animate-spin text-primary" size={32} />
          <p className="font-bold text-foreground">Confirming your payment...</p>
        </div>
      }
    >
      <ConfirmingClient />
    </Suspense>
  );
}
