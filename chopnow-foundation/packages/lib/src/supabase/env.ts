/**
 * Reads and normalizes NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (or the service role key) for the three places that build a Supabase
 * client (server.ts, client.ts, middleware.ts).
 *
 * Trims whitespace and strips a trailing slash from the URL before it's
 * handed to the Supabase SDK. Without this, a value pasted into a
 * deployment's environment variables with a trailing slash or a stray
 * trailing newline/space (easy to pick up copy-pasting on a phone, and
 * invisible once pasted) makes the SDK build malformed auth endpoint
 * paths like "https://xxxx.supabase.co//auth/v1/signup" — Supabase's
 * gateway rejects that with an opaque "Invalid path specified in request
 * URL" error that gives no hint the real problem is whitespace in an env
 * var back in the deployment's own config.
 */
export function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) {
    throw new Error(
      "Missing Supabase environment variable NEXT_PUBLIC_SUPABASE_URL (see .env.example).",
    );
  }
  return raw.trim().replace(/\/+$/, "");
}

export function getSupabaseAnonKey(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!raw) {
    throw new Error(
      "Missing Supabase environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return raw.trim();
}

export function getSupabaseServiceRoleKey(): string {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw) {
    throw new Error(
      "Missing Supabase environment variable SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
    );
  }
  return raw.trim();
}
