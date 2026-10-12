import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.generated";

/**
 * Creates a Supabase client bound to a Next.js middleware request/response
 * pair, refreshing the auth session cookie on every request. This is the
 * piece that keeps a user's session alive across page loads without them
 * ever needing to re-authenticate — see each app's `middleware.ts` for
 * where this is invoked.
 */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY are set (see .env.example).",
    );
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write to the request first so this same middleware invocation
        // sees the refreshed session, then rebuild the response so the
        // Set-Cookie headers actually reach the browser.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, getResponse: () => response };
}
