/**
 * Roles recognized across all ChopNow apps (web, admin, rider).
 *
 * "restaurant" exists now as a type-level placeholder for the planned
 * restaurant self-service dashboard (see architecture docs) — restaurants
 * currently have no login, but modeling the role now means adding that
 * dashboard later is additive, not a breaking schema/type change.
 */
export type UserRole = "customer" | "admin" | "dispatcher" | "restaurant" | "rider";

export const USER_ROLES: readonly UserRole[] = [
  "customer",
  "admin",
  "dispatcher",
  "restaurant",
  "rider",
] as const;

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

/**
 * A profile row — one per authenticated user, regardless of role.
 * Mirrors `public.profiles` in the database.
 */
export interface Profile {
  id: string;
  role: UserRole;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

/**
 * The shape of the currently authenticated session's user, as consumed
 * by client components. Distinct from Supabase's own `User` type so app
 * code depends on a stable, ChopNow-specific shape.
 */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  profile: Profile | null;
}
