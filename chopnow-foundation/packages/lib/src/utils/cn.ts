import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional classnames (via clsx) and then resolves Tailwind
 * class conflicts (via tailwind-merge) — e.g. `cn("px-2", condition && "px-4")`
 * correctly resolves to just "px-4" instead of emitting both classes.
 * Standard shadcn/ui convention; used throughout packages/ui.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
