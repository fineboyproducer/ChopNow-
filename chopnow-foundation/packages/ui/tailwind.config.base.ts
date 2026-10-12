import type { Config } from "tailwindcss";
import { colors, spacing, radius, fontFamily, fontSize } from "./src/tokens";

/**
 * Shared Tailwind config. Each app's own tailwind.config.ts spreads this
 * in and adds its own `content` globs (paths differ per app), so the
 * design tokens can never drift between apps while each app still
 * controls what gets scanned for class usage.
 */
const sharedTailwindConfig: Partial<Config> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        // Direct brand tokens, for cases that want the exact brand hex
        // rather than the semantic shadcn CSS-variable tokens above.
        chopnow: colors,
      },
      borderRadius: {
        // sm/md/lg track the themeable --radius CSS variable (see
        // globals.css) so they scale together app-wide. The brand token
        // scale in ./src/tokens adds its own sm/md/lg too, but those are a
        // *separate*, static px scale for things that shouldn't move with
        // the theme — spreading it wholesale here would silently clobber
        // the CSS-var-driven keys above (and duplicate TS object keys fail
        // the production build outright), so only its non-colliding keys
        // (xl/2xl/none/full) are pulled in.
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: radius.xl,
        "2xl": radius["2xl"],
        none: radius.none,
        full: radius.full,
      },
      spacing,
      // Tailwind's Config type wants plain mutable string[]/tuples, but
      // the token modules export `as const` readonly tuples so every
      // *other* consumer (components, tests) gets literal types. Widen
      // just at this Tailwind-config boundary instead of losing that.
      fontFamily: { sans: [...fontFamily.sans] },
      fontSize: Object.fromEntries(
        Object.entries(fontSize).map(([key, [size, opts]]) => [key, [size, { ...opts }]]),
      ) as Record<string, [string, { lineHeight: string }]>,
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.4s ease both",
        "slide-in": "slide-in 0.3s ease",
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
};

export default sharedTailwindConfig;
