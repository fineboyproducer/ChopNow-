"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Receipt, Heart, User } from "lucide-react";
import { cn } from "@chopnow/lib";

const ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discover", label: "Search", icon: Search },
  { href: "/account/orders", label: "Orders", icon: Receipt },
  { href: "/account/favorites", label: "Favourites", icon: Heart },
  { href: "/account/profile", label: "Profile", icon: User },
];

export function CustomerBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 px-1 py-2 backdrop-blur md:hidden">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 px-3 py-1">
            <item.icon
              size={21}
              strokeWidth={2.3}
              className={cn(active ? "text-primary" : "text-muted-foreground")}
            />
            <span className={cn("text-[9.5px] font-bold", active ? "text-primary" : "text-muted-foreground")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
