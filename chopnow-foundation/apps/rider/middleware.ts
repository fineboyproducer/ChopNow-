import { createRouteGuardMiddleware } from "@chopnow/lib";

/**
 * Route protection for the rider app. Only the `rider` role may access
 * anything here (PRD Section 5.7, FR-AUTH-04) — customers, admin, and
 * dispatchers are redirected to /unauthorized. Like apps/admin, rider
 * accounts are created directly by an existing admin (FR-AUTH-02); there
 * is no public sign-up.
 *
 * The manifest and service worker must stay public — a rider's device
 * needs to fetch them before a session exists (e.g. on first install,
 * or when the service worker itself runs a background fetch outside
 * any authenticated page context).
 */
export const middleware = createRouteGuardMiddleware({
  allowedRoles: ["rider"],
  publicPaths: ["/sign-in", "/auth/callback", "/unauthorized", "/manifest.webmanifest", "/service-worker.js", "/icons"],
});

// Next.js statically parses this export at build time, so the matcher must
// be a literal here — it can't be an imported constant (even though the
// same value is also exported as DEFAULT_MIDDLEWARE_MATCHER from
// @chopnow/lib for reuse in apps/web and apps/admin's middleware).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
