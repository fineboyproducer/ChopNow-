/** Formats an integer naira amount as "₦2,500" — no decimals, since ChopNow prices are whole naira. */
export function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

/**
 * Default global markup applied on top of a restaurant's own price
 * before it's shown to customers. See `applyMarkup` — this constant is
 * only the fallback; the actual value should come from
 * `platform_settings` (global_markup_percent) and per-restaurant
 * `markup_percent_override`, both modeled in the database schema.
 */
export const DEFAULT_MARKUP_PERCENT = 8;

export interface MarkupInput {
  basePrice: number;
  markupPercentOverride?: number | null;
  globalMarkupPercent?: number;
}

/**
 * Applies ChopNow's markup to a restaurant's base price and rounds to
 * the nearest ₦10 for a clean customer-facing price. This is the single
 * source of truth for the markup calculation — call it from both the
 * menu-display code path and the order-creation code path so the price
 * a customer sees is guaranteed to match what they're charged.
 */
export function applyMarkup({
  basePrice,
  markupPercentOverride,
  globalMarkupPercent = DEFAULT_MARKUP_PERCENT,
}: MarkupInput): number {
  const percent = markupPercentOverride ?? globalMarkupPercent;
  const marked = basePrice * (1 + percent / 100);
  return Math.round(marked / 10) * 10;
}
