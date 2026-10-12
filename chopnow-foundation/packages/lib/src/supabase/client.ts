import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.generated";
import { getSupabaseUrl, getSupabaseAnonKey } from "./env";

/**
 * Supabase client for use in Client Components ("use client").
 * Safe to call multiple times — @supabase/ssr manages a singleton
 * under the hood via the browser's storage, but we still memoize
 * here to avoid creating a new client instance on every render.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
