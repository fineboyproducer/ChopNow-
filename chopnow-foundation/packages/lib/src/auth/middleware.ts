import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@chopnow/types";
import { createSupabaseMiddlewareClient } from "../supabase/middleware";
import { getAuthenticatedUser, hasRole } from "./session";

export interface RouteGuardConfig {
  /** Roles allowed to access any non-public route in this app. */
  allowedRoles: UserRole[];
  /**
   * Path prefixes that never require authentication (e.g. sign-in pages,
   * marketing pages, auth callback routes). Matched with `startsWith`.
   */
  publicPaths: string[];
  /** Where to send an unauthenticated user. Defaults to "/sign-in". */
  signInPath?: string;
  /**
   * Where to send an authenticated user whose role isn't allowed here.
   * Defaults to a generic "/unauthorized" page.
   */
  unauthorizedPath?: string;
}

function isPublicPath(pathname: string, publicPaths: string[]): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Builds a Next.js middleware function that:
 *   1. Refreshes the Supabase session cookie on every request.
 *   2. Allows configured public paths through untouched.
 *   3. Redirects unauthenticated users to sign-in, preserving the
 *      originally requested path as a `redirectTo` query param.
 *   4. Redirects authenticated users whose role isn't permitted in this
 *      app to an "unauthorized" page, rather than granting access.
 *
 * Each app's `middleware.ts` is expected to be a thin wrapper:
 *
 *   export const middleware = createRouteGuardMiddleware({
 *     allowedRoles: ["admin", "dispatcher"],
 *     publicPaths: ["/sign-in", "/auth/callback"],
 *   });
 */
export function createRouteGuardMiddleware(config: RouteGuardConfig) {
  const signInPath = config.signInPath ?? "/sign-in";
  const unauthorizedPath = config.unauthorizedPath ?? "/unauthorized";

  return async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Middleware runs on every request, including pages that are public
    // and have no Supabase dependency of their own (home, discover, the
    // landing page). If Supabase isn't configured yet — no project
    // provisioned, env vars unset — that must not take down those pages
    // too: fail open to "no session" rather than letting the client
    // factory's error crash the whole site. A route that actually
    // requires auth still correctly falls through to the sign-in
    // redirect below, same as any other unauthenticated visitor.
    let supabase: ReturnType<typeof createSupabaseMiddlewareClient>["supabase"] | undefined;
    let getResponse: ReturnType<typeof createSupabaseMiddlewareClient>["getResponse"] = () =>
      NextResponse.next({ request });
    try {
      ({ supabase, getResponse } = createSupabaseMiddlewareClient(request));
    } catch (error) {
      console.error("[auth middleware] Supabase client unavailable, treating as signed out:", error);
    }

    // Always let the session refresh happen, even on public paths, so a
    // user's session stays alive while browsing public pages too.
    const user = supabase ? await getAuthenticatedUser(supabase) : null;

    if (isPublicPath(pathname, config.publicPaths)) {
      return getResponse();
    }

    if (!user) {
      const redirectUrl = new URL(signInPath, request.url);
      redirectUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (!hasRole(user, ...config.allowedRoles)) {
      return NextResponse.redirect(new URL(unauthorizedPath, request.url));
    }

    return getResponse();
  };
}

/** Standard Next.js matcher — excludes static assets and image optimization. */
export const DEFAULT_MIDDLEWARE_MATCHER = [
  "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
];
