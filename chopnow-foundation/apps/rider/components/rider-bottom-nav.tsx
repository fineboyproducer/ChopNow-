"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, Wallet, History, User } from "lucide-react";
import { cn } from "@chopnow/lib";

const ITEMS = [
  { href: "/deliveries", label: "Deliveries", icon: Bike },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
];

export function RiderBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 px-1 py-2 backdrop-blur">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 px-4 py-1">
            <item.icon size={21} strokeWidth={2.3} className={cn(active ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-[9.5px] font-bold", active ? "text-primary" : "text-muted-foreground")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
