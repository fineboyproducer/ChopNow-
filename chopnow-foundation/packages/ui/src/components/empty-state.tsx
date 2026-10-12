import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@chopnow/lib";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Generic empty-state layout: icon in a soft rounded tile, title,
 * optional description, optional action button. Every "no X yet" /
 * "nothing found" screen across all three apps should use this rather
 * than a bare "No data" string, per the "zero placeholder code" /
 * "never show blank pages" requirement.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center px-6 py-14 text-center", className)}
      {...props}
    >
      {Icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
          <Icon className="h-7 w-7 text-accent-foreground" strokeWidth={1.6} />
        </div>
      )}
      <h3 className="text-[17px] font-bold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
