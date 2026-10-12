import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient, getAuthenticatedUser, hasRole } from "@chopnow/lib";
import { AdminShell } from "@/components/admin-shell";

/**
 * Server-side defense in depth alongside middleware.ts: middleware
 * already redirects unauthenticated/wrong-role requests before they
 * reach here, but checking again in the layout means this route group
 * fails closed even if middleware config ever drifts (e.g. a future
 * edit to the matcher that accidentally excludes a path).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);

  if (!hasRole(user, "admin", "dispatcher")) {
    redirect("/sign-in");
  }

  return <AdminShell>{children}</AdminShell>;
}
