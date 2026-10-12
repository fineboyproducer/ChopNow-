import { createRouteGuardMiddleware } from "@chopnow/lib";

/**
 * Route protection for the customer-facing app.
 *
 * Browsing is intentionally public — home, discovery, and restaurant
 * pages don't require a session, matching how real food-delivery apps
 * let you look before you sign in. Checkout and account pages do require
 * an authenticated `customer` session, since placing an order and
 * viewing personal data both need to know who's asking.
 *
 * /api/webhooks/* is public deliberately and for a different reason:
 * Paystack calls this server-to-server with no browser session at all.
 * Redirecting it to /sign-in (as would happen if it weren't public)
 * would silently break payment confirmation entirely — see PRD Section
 * 7.8 and app/api/webhooks/paystack/route.ts, which does its own
 * signature-based authentication instead of relying on a user session.
 */
export const middleware = createRouteGuardMiddleware({
  allowedRoles: ["customer"],
  publicPaths: [
    "/",
    "/home",
    "/discover",
    "/restaurants",
    "/sign-in",
    "/sign-up",
    "/auth/callback",
    "/unauthorized",
    "/api/webhooks",
  ],
});

// Next.js statically parses this export at build time, so the matcher must
// be a literal here — it can't be an imported constant (even though the
// same value is also exported as DEFAULT_MIDDLEWARE_MATCHER from
// @chopnow/lib for reuse in apps/admin and apps/rider's middleware).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
