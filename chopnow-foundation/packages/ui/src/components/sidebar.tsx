import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@chopnow/lib";

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Optional badge, e.g. a count of pending items. */
  badge?: React.ReactNode;
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  brand?: React.ReactNode;
  items: SidebarItem[];
  /** id of the currently active item, for highlighting. */
  activeId?: string;
  footer?: React.ReactNode;
  /**
   * Render prop for links so each app can plug in its own router's Link
   * component (Next.js `Link`) instead of this package depending on
   * next/link directly.
   */
  renderLink: (item: SidebarItem, children: React.ReactNode) => React.ReactNode;
}

export function Sidebar({
  brand,
  items,
  activeId,
  footer,
  renderLink,
  className,
  ...props
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-background",
        className,
      )}
      {...props}
    >
      {brand && <div className="flex h-14 items-center gap-2 border-b border-border px-4">{brand}</div>}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {items.map((item) => {
          const isActive = item.id === activeId;
          const content = (
            <span
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] font-bold transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge}
            </span>
          );
          return <React.Fragment key={item.id}>{renderLink(item, content)}</React.Fragment>;
        })}
      </nav>
      {footer && <div className="border-t border-border p-3">{footer}</div>}
    </aside>
  );
}
