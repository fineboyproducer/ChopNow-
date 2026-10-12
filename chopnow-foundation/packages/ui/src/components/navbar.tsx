import * as React from "react";
import { cn } from "@chopnow/lib";

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  /** Rendered at the far left — typically a logo/brand mark + name. */
  brand?: React.ReactNode;
  /** Rendered centered (desktop only by default) — typically nav links. */
  center?: React.ReactNode;
  /** Rendered at the far right — typically actions: search, theme toggle, avatar. */
  actions?: React.ReactNode;
  /** Adds a background blur + shadow, intended to be toggled on scroll by the consuming app. */
  elevated?: boolean;
}

/**
 * Structural navbar shell. Each app supplies its own `brand` / `center` /
 * `actions` content (the three apps have meaningfully different nav
 * needs — marketing links for web, admin search for admin, online/offline
 * toggle for rider) rather than this component hardcoding any of them.
 */
export function Navbar({
  brand,
  center,
  actions,
  elevated = false,
  className,
  ...props
}: NavbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-16 w-full border-b border-border bg-background/85 backdrop-blur transition-shadow",
        elevated && "shadow-[0_2px_20px_-8px_rgba(31,41,55,0.15)]",
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
        <div className="flex shrink-0 items-center gap-2">{brand}</div>
        {center && <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">{center}</nav>}
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
