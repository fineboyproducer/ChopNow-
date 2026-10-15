"use client";

import * as React from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Store, UtensilsCrossed, Users, Receipt, BarChart3, Settings, LogOut,
  GitBranch, Radar, Bike, AlertTriangle, Menu,
} from "lucide-react";
import {
  Logo, Sidebar, ThemeToggle, Drawer, DrawerContent, DrawerTitle, DrawerTrigger, type SidebarItem,
} from "@chopnow/ui";
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

const BRAND = <Logo size={26} badge="Admin" />;

const SIGN_OUT = (
  <form action={signOutAction}>
    <button
      type="submit"
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <LogOut size={15} /> Sign out
    </button>
  </form>
);

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const activeId = NAV_ITEMS.find((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))?.id;

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop / tablet (md+): persistent sidebar, unchanged. */}
      <Sidebar
        className="hidden md:flex"
        items={NAV_ITEMS}
        activeId={activeId}
        brand={BRAND}
        renderLink={(item, content) => <Link href={item.href}>{content}</Link>}
        footer={SIGN_OUT}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-5 md:justify-end">
          {/* Mobile (<md): hamburger opens the same nav in a slide-out drawer. */}
          <div className="flex items-center gap-2 md:hidden">
            <Drawer open={navOpen} onOpenChange={setNavOpen}>
              <DrawerTrigger
                aria-label="Open navigation menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
              >
                <Menu size={20} />
              </DrawerTrigger>
              <DrawerContent side="left" className="w-72 max-w-[85vw] sm:max-w-xs" aria-describedby={undefined}>
                <DrawerTitle className="sr-only">Navigation</DrawerTitle>
                <Sidebar
                  className="relative h-full w-full border-r-0"
                  items={NAV_ITEMS}
                  activeId={activeId}
                  brand={BRAND}
                  renderLink={(item, content) => (
                    <Link href={item.href} onClick={() => setNavOpen(false)}>
                      {content}
                    </Link>
                  )}
                  footer={SIGN_OUT}
                />
              </DrawerContent>
            </Drawer>
            <span className="text-[13px] font-extrabold text-foreground">ChopNow Admin</span>
          </div>
          <ThemeToggle />
        </header>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
