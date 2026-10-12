import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "./database.generated";
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey } from "./env";

/**
 * Minimal cookie store contract this factory needs. In Next.js App Router,
 * pass the result of `cookies()` from `next/headers` — it satisfies this
 * shape. Kept as an interface (rather than importing `next/headers`
 * directly) so this package has no hard dependency on Next.js and can be
 * reused from non-Next contexts (e.g. scripts, tests) if needed.
 */
export interface ServerCookieStore {
  getAll(): { name: string; value: string }[];
  set?(name: string, value: string, options?: CookieOptions): void;
}

/**
 * Supabase client for use in Server Components, Server Actions, and
 * Route Handlers. Must be created fresh per-request (cookies differ
 * per request), so this is a factory, not a singleton.
 *
 * Usage in a Server Component:
 *   import { cookies } from "next/headers";
 *   const supabase = createSupabaseServerClient(cookies());
 */
export function createSupabaseServerClient(cookieStore: ServerCookieStore) {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set?.(name, value, options);
          });
        } catch {
          // Called from a Server Component (not a Server Action / Route
          // Handler) — cookies can't be mutated there. Session refresh
          // is instead handled by the middleware, so this is safe to
          // swallow rather than throw.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses Row Level Security entirely. Only ever
 * instantiate this in trusted server-only code (Route Handlers, Edge
 * Functions, cron jobs) that has already performed its own authorization
 * checks. Never import this into anything that ships to the client bundle.
 */
export function createSupabaseServiceRoleClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createServerClient<Database>(url, serviceRoleKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // no-op: service role client is not session-bound
      },
    },
  });
}
