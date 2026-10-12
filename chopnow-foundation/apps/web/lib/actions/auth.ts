"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  safeParseWithFieldErrors,
  signInWithPasswordSchema,
  signUpSchema,
  toAppError,
  createLogger,
} from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";

const log = createLogger("web-auth-actions");

/**
 * Server Action backing the sign-in form. Returns a plain ApiResponse
 * (never throws) so the client form can render field errors inline
 * without an error boundary — Server Actions that throw produce a much
 * worse UX for expected validation failures.
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
  } catch (err) {
    const appError = toAppError(err);
    log.error("Sign-in failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }

  redirect("/home");
}

/**
 * Server Action backing the sign-up form. Creates the auth user; the
 * corresponding `profiles` row is created by a database trigger (see
 * supabase/migrations) rather than here, so the profile always exists
 * even if this action's caller never runs again.
 */
export async function signUpAction(_prevState: unknown, formData: FormData): Promise<ApiResponse<null>> {
  const parsed = safeParseWithFieldErrors(signUpSchema, {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
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

    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_WEB_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      return { success: false, error: { code: "CONFLICT", message: error.message } };
    }
  } catch (err) {
    const appError = toAppError(err);
    log.error("Sign-up failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }

  redirect("/sign-in?confirmEmail=1");
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  await supabase.auth.signOut();
  redirect("/sign-in");
}
