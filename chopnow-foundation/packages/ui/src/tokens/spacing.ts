/**
 * Spacing scale — a 4px base unit, matching Tailwind's default scale but
 * declared explicitly here so non-Tailwind consumers (inline styles in
 * chart/canvas code, email templates) stay in lockstep with it.
 */
export const spacing = {
  px: "1px",
  0: "0px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  3.5: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  9: "36px",
  10: "40px",
  12: "48px",
  14: "56px",
  16: "64px",
  20: "80px",
  24: "96px",
  28: "112px",
  32: "128px",
} as const;

/** Border radius scale — 16-20px "premium rounded" as specified in the brand brief, plus smaller utility sizes. */
export const radius = {
  none: "0px",
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "18px",
  "2xl": "22px",
  full: "9999px",
} as const;

export type SpacingTokens = typeof spacing;
export type RadiusTokens = typeof radius;
