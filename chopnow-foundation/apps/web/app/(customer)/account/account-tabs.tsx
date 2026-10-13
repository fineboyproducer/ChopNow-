"use client";

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

export function AccountTabs() {
  const pathname = usePathname();

  return (
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
  );
}
