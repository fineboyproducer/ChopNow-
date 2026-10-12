"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Store, UtensilsCrossed, Users, Receipt, BarChart3, Settings, LogOut, ChefHat,
  GitBranch, Radar, Bike, AlertTriangle,
} from "lucide-react";
import { Sidebar, ThemeToggle, type SidebarItem } from "@chopnow/ui";
import { signOutAction } from "@/lib/actions/auth";

const NAV_ITEMS: SidebarItem[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { id: "pipeline", label: "Pipeline", icon: GitBranch, href: "/pipeline" },
  { id: "dispatch", label: "Dispatch", icon: Radar, href: "/dispatch" },
  { id: "riders", label: "Riders", icon: Bike, href: "/riders" },
  { id: "alerts", label: "Alerts", icon: AlertTriangle, href: "/alerts" },
  { id: "restaurants", label: "Restaurants", icon: Store, href: "/restaurants" },
  { id: "menus", label: "Menus", icon: UtensilsCrossed, href: "/menus" },
  { id: "orders", label: "Orders", icon: Receipt, href: "/orders" },
  { id: "customers", label: "Customers", icon: Users, href: "/customers" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/analytics" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeId = NAV_ITEMS.find((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))?.id;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={NAV_ITEMS}
        activeId={activeId}
        brand={
          <>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ChefHat size={14} />
            </div>
            <div>
              <p className="text-[13px] font-extrabold leading-none text-foreground">ChopNow</p>
              <p className="mt-0.5 text-[9px] leading-none text-muted-foreground">Admin</p>
            </div>
          </>
        }
        renderLink={(item, content) => <Link href={item.href}>{content}</Link>}
        footer={
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut size={15} /> Sign out
            </button>
          </form>
        }
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end border-b border-border bg-background/95 px-5 backdrop-blur">
          <ThemeToggle />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
