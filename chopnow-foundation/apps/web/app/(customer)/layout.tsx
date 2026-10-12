import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart/cart-context";
import { CustomerNavbar } from "@/components/customer/customer-navbar";
import { CustomerBottomNav } from "@/components/customer/customer-bottom-nav";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <CustomerNavbar />
      <div className="pb-20 md:pb-0">{children}</div>
      <CustomerBottomNav />
    </CartProvider>
  );
}
