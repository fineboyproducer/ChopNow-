import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.generated";

/**
 * Supabase client for use in Client Components ("use client").
 * Safe to call multiple times — @supabase/ssr manages a singleton
 * under the hood via the browser's storage, but we still memoize
 * here to avoid creating a new client instance on every render.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY are set (see .env.example).",
    );
  }

  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
