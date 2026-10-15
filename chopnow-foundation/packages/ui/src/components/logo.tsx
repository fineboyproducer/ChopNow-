import * as React from "react";
import { cn } from "@chopnow/lib";
import { MARK_PATH, MARK_VIEWBOX_HEIGHT, MARK_VIEWBOX_WIDTH } from "../brand/mark-path";

export interface LogoMarkProps extends React.SVGAttributes<SVGSVGElement> {
  /** Rendered height in px; width follows the mark's aspect ratio. */
  size?: number;
}

/**
 * The ChopNow bowl mark. Fills with `currentColor`, so it is brand orange by
 * default (text-primary) and can be made white, charcoal, etc. with a text
 * colour class.
 */
export function LogoMark({ size = 28, className, ...props }: LogoMarkProps) {
  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX_WIDTH} ${MARK_VIEWBOX_HEIGHT}`}
      height={size}
      width={(size * MARK_VIEWBOX_WIDTH) / MARK_VIEWBOX_HEIGHT}
      className={cn("shrink-0 text-primary", className)}
      role="img"
      aria-label="ChopNow"
      {...props}
    >
      <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

export interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Mark height in px. The wordmark scales with it. */
  size?: number;
  /** Show "Order. Relax. Enjoy." under the wordmark. */
  tagline?: boolean;
  /** Small label after the wordmark, e.g. "Admin" or "Rider". */
  badge?: string;
}

/** Mark + "ChopNow" wordmark ("Chop" in foreground/charcoal, "Now" in brand orange). */
export function Logo({ size = 28, tagline = false, badge, className, ...props }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} {...props}>
      <LogoMark size={size} aria-hidden="true" role="presentation" aria-label={undefined} />
      <span className="flex flex-col leading-none">
        <span className="font-extrabold tracking-tight text-foreground" style={{ fontSize: size * 0.68 }}>
          Chop<span className="text-primary">Now</span>
          {badge && (
            <span className="ml-1.5 align-middle text-[0.5em] font-bold uppercase tracking-wider text-muted-foreground">
              {badge}
            </span>
          )}
        </span>
        {tagline && (
          <span className="mt-1 text-[0.4em] font-semibold tracking-[0.18em] text-muted-foreground" style={{ fontSize: size * 0.3 }}>
            Order. Relax. Enjoy.
          </span>
        )}
      </span>
    </span>
  );
}
