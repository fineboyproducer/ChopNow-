import { createRouteGuardMiddleware } from "@chopnow/lib";

/**
 * Route protection for the admin/ops app. Only `admin` and `dispatcher`
 * roles may access anything here — customers, riders, and the reserved
 * `restaurant` role are redirected to /unauthorized (see PRD Section 5.7,
 * FR-AUTH-04). There is no public signup for this app: admin/dispatcher
 * accounts are created directly by an existing admin (FR-AUTH-02), so
 * /sign-in is the only public path — there's deliberately no /sign-up.
 */
export const middleware = createRouteGuardMiddleware({
  allowedRoles: ["admin", "dispatcher"],
  publicPaths: ["/sign-in", "/auth/callback", "/unauthorized"],
});

// Next.js statically parses this export at build time, so the matcher must
// be a literal here — it can't be an imported constant (even though the
// same value is also exported as DEFAULT_MIDDLEWARE_MATCHER from
// @chopnow/lib for reuse in apps/web and apps/rider's middleware).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
