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

const log = createLogger("rider-auth-actions");

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
    if (!hasRole(user, "rider")) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "This account isn't registered as a ChopNow rider." },
      };
    }

    const { data: existingRider } = await supabase.from("riders").select("id").eq("id", user!.id).maybeSingle();
    if (!existingRider) {
      await supabase.from("riders").insert({ id: user!.id });
    }
  } catch (err) {
    const appError = toAppError(err);
    log.error("Rider sign-in failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }

  redirect("/deliveries");
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const user = await getAuthenticatedUser(supabase);
  if (user) {
    await supabase.from("riders").update({ is_online: false }).eq("id", user.id);
  }

  await supabase.auth.signOut();
  redirect("/sign-in");
}
