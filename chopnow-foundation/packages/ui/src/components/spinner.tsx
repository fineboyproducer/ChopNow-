import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@chopnow/lib";

const spinnerVariants = cva("animate-spin rounded-full border-solid border-current", {
  variants: {
    size: {
      sm: "h-3.5 w-3.5 border-2",
      md: "h-5 w-5 border-2",
      lg: "h-8 w-8 border-[3px]",
    },
    tone: {
      current: "border-t-transparent text-current",
      primary: "border-primary/25 border-t-primary",
      muted: "border-muted-foreground/20 border-t-muted-foreground",
    },
  },
  defaultVariants: { size: "md", tone: "current" },
});

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  /** Accessible label announced to screen readers while loading. */
  label?: string;
}

export function Spinner({ size, tone, label = "Loading", className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(spinnerVariants({ size, tone }), className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
