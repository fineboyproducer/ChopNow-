import { AppError } from "./errors";

/**
 * Resolves the public base URL for one of the three apps (web, admin,
 * rider), validating it's actually a well-formed absolute URL before
 * anything tries to build a redirect from it.
 *
 * Without this, a missing env var (e.g. NEXT_PUBLIC_WEB_APP_URL unset in
 * a deployment's environment variables) silently produces a string like
 * "undefined/auth/callback" wherever it's interpolated — which isn't a
 * valid URL, and downstream consumers like Supabase's auth API reject it
 * with an opaque error ("invalid path specified in url") that gives no
 * hint the real problem is a missing env var back in this app's own
 * deployment config. Failing here instead, with a message that names the
 * exact env var, turns a confusing runtime surprise into an actionable
 * one.
 */
export function getAppUrl(which: "web" | "admin" | "rider" = "web"): string {
  const envVar = {
    web: "NEXT_PUBLIC_WEB_APP_URL",
    admin: "NEXT_PUBLIC_ADMIN_APP_URL",
    rider: "NEXT_PUBLIC_RIDER_APP_URL",
  }[which];

  const raw = process.env[envVar];

  if (!raw) {
    throw AppError.internal(
      `${envVar} is not set. Add it in your deployment's environment variables (e.g. Vercel → Settings → Environment Variables) — see .env.example.`,
    );
  }

  try {
    // Throws if `raw` isn't a well-formed absolute URL (missing protocol,
    // stray whitespace, etc.) — better to catch that here than let it
    // surface as a cryptic failure from whatever API consumes it next.
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    throw AppError.internal(
      `${envVar} is set to "${raw}", which isn't a valid URL. It should look like https://your-app.vercel.app (no trailing slash).`,
    );
  }
}
