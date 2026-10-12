"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, MapPin, Heart, User } from "lucide-react";
import { cn } from "@chopnow/lib";

const TABS = [
  { href: "/account/orders", label: "Orders", icon: Receipt },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/favorites", label: "Favourites", icon: Heart },
  { href: "/account/profile", label: "Profile", icon: User },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 md:px-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-black text-primary-foreground">
          C
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground">Chidera Okafor</h1>
          <p className="text-[12px] text-muted-foreground">080X XXX XXXX · Ekpoma, Edo State</p>
        </div>
      </div>

      <div className="scrollbar-hide mb-5 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-[12.5px] font-bold transition-colors",
                active
                  ? "border-secondary bg-secondary text-secondary-foreground"
                  : "border-border text-foreground/80",
              )}
            >
              <tab.icon size={13} /> {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
