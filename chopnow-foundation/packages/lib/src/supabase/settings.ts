import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.generated";
import { DEFAULT_MARKUP_PERCENT } from "../utils/currency";

/**
 * Fetches the live global markup percentage from `platform_settings`.
 * This is the single fetch point every code path that needs the current
 * markup should call — menu display, cart pricing, and order creation
 * all use this rather than each hardcoding or separately querying the
 * same value, which is exactly the kind of drift that let menu display
 * silently diverge from checkout pricing in an earlier version of this
 * codebase (menu/cart used the DEFAULT_MARKUP_PERCENT fallback while
 * order creation queried the live value — this function exists so that
 * mistake can't happen again).
 *
 * Falls back to DEFAULT_MARKUP_PERCENT only if the settings row is
 * missing or the query fails, so a transient DB hiccup degrades to a
 * reasonable default rather than breaking checkout entirely.
 */
export async function getGlobalMarkupPercent(supabase: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "global_markup_percent")
    .single();

  if (error || !data) return DEFAULT_MARKUP_PERCENT;

  const parsed = Number(data.value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_MARKUP_PERCENT;
}
