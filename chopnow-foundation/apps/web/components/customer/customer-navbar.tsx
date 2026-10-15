"use client";

import Link from "next/link";
import { ShoppingBag, User } from "lucide-react";
import { Navbar, ThemeToggle, Button, Logo } from "@chopnow/ui";
import { useCart } from "@/lib/cart/cart-context";
import { CartDrawer } from "./cart-drawer";
import * as React from "react";

export function CustomerNavbar() {
  const { itemCount } = useCart();
  const [cartOpen, setCartOpen] = React.useState(false);

  return (
    <>
      <Navbar
        elevated
        brand={
          <Link href="/home" aria-label="ChopNow home">
            <Logo size={30} />
          </Link>
        }
        center={
          <>
            <Link
              href="/home"
              className="rounded-full px-4 py-2 text-[13.5px] font-bold text-muted-foreground hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/discover"
              className="rounded-full px-4 py-2 text-[13.5px] font-bold text-muted-foreground hover:text-foreground"
            >
              Restaurants
            </Link>
            <Link
              href="/account/orders"
              className="rounded-full px-4 py-2 text-[13.5px] font-bold text-muted-foreground hover:text-foreground"
            >
              Orders
            </Link>
          </>
        }
        actions={
          <>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Open cart"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={17} />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Account">
              <Link href="/account/profile">
                <User size={17} />
              </Link>
            </Button>
          </>
        }
      />
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
