"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  hasRole,
  safeParseWithFieldErrors,
  signInWithPasswordSchema,
  toAppError,
  createLogger,
} from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";

const log = createLogger("admin-auth-actions");

/**
 * Signs in an admin/dispatcher. Unlike apps/web, there is no sign-up
 * action here — admin and dispatcher accounts are provisioned directly
 * by an existing admin (PRD FR-AUTH-02), not through public self-signup.
 * After a successful password check, this also verifies the resulting
 * profile actually has an admin/dispatcher role and signs the user back
 * out immediately if not — a customer or rider account that happens to
 * guess this app's URL should never get a valid session here, even
 * briefly, rather than relying solely on middleware to catch it on the
 * next request.
 */
export async function signInAction(_prevState: unknown, formData: FormData): Promise<ApiResponse<null>> {
  const parsed = safeParseWithFieldErrors(signInWithPasswordSchema, {
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors },
    };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);

    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return { success: false, error: { code: "UNAUTHENTICATED", message: error.message } };
    }

    const user = await getAuthenticatedUser(supabase);
    if (!hasRole(user, "admin", "dispatcher")) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "This account doesn't have access to the ChopNow admin dashboard.",
        },
      };
    }
  } catch (err) {
    const appError = toAppError(err);
    log.error("Admin sign-in failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }

  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  await supabase.auth.signOut();
  redirect("/sign-in");
}
