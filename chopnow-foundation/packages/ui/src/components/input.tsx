import * as React from "react";
import { cn } from "@chopnow/lib";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Shows a red border + focus ring, for use alongside an error message. */
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        aria-invalid={invalid}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          invalid && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
