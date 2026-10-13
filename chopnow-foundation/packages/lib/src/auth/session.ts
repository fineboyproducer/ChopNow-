import type { AuthenticatedUser, Profile, UserRole } from "@chopnow/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.generated";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Resolves the current authenticated user plus their `profiles` row,
 * given any already-constructed Supabase client (browser, server, or
 * middleware variant all satisfy this signature). Returns null if there
 * is no authenticated session — callers decide whether that's an error.
 */
export async function getAuthenticatedUser(
  supabase: SupabaseClient<Database>,
): Promise<AuthenticatedUser | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (profileError || !profileRow) {
    // A user can exist in auth.users with no profiles row yet (e.g. the
    // trigger that creates one hasn't run, or ran into an error). Treat
    // this as "authenticated but unprovisioned" rather than throwing —
    // callers can redirect to an onboarding step instead of crashing.
    //
    // Logged deliberately (not swallowed) — a user with a *real* profiles
    // row still hitting this branch (confirmed via Supabase Table Editor)
    // means the SELECT itself is failing, most likely RLS rejecting the
    // request because auth.uid() isn't resolving inside this query even
    // though supabase.auth.getUser() above succeeded. The error's code/
    // message (e.g. an RLS/PGRST permission code vs. PGRST116 "no rows
    // found") is the one thing that can actually distinguish those cases
    // from here, and is otherwise invisible to anyone looking at the app.
    console.error("[getAuthenticatedUser] profile lookup failed for authenticated user", {
      userId: user.id,
      errorCode: profileError?.code,
      errorMessage: profileError?.message,
      errorDetails: profileError?.details,
      errorHint: profileError?.hint,
    });
    return { id: user.id, email: user.email ?? null, phone: user.phone ?? null, profile: null };
  }

  const profile: Profile = {
    id: profileRow.id,
    role: profileRow.role,
    fullName: profileRow.full_name,
    phone: profileRow.phone,
    avatarUrl: profileRow.avatar_url,
    createdAt: profileRow.created_at,
  };

  return { id: user.id, email: user.email ?? null, phone: user.phone ?? null, profile };
}

/** True if the given user has one of the allowed roles. */
export function hasRole(user: AuthenticatedUser | null, ...allowed: UserRole[]): boolean {
  if (!user?.profile) return false;
  return allowed.includes(user.profile.role);
}

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Throws UnauthorizedError / ForbiddenError as appropriate, otherwise
 * returns the authenticated user. Intended for use at the top of Server
 * Actions and Route Handlers that require a specific role.
 */
export function requireRole(
  user: AuthenticatedUser | null,
  ...allowed: UserRole[]
): AuthenticatedUser {
  if (!user) throw new UnauthorizedError();
  if (!hasRole(user, ...allowed)) throw new ForbiddenError();
  return user;
}
