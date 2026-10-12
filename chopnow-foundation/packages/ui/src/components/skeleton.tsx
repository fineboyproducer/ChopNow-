import * as React from "react";
import { cn } from "@chopnow/lib";

/**
 * Shimmering placeholder block. Compose several of these to build a
 * skeleton matching a real component's layout (see SkeletonCard /
 * SkeletonText below for ready-made compositions), rather than ever
 * shipping a blank loading page.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-lg bg-muted", className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10" />
    </div>
  );
}

/** A few lines of placeholder text, useful for card bodies / list rows. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** A generic card-shaped skeleton: image block + title + text lines. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-2xl border border-border p-4", className)}>
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <SkeletonText lines={2} />
    </div>
  );
}
