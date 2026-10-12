"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, getAuthenticatedUser, requireRole, toAppError, createLogger } from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";

const log = createLogger("admin-alert-actions");

export async function resolveAlertAction(alertId: string): Promise<ApiResponse<null>> {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const user = await getAuthenticatedUser(supabase);
    const authed = requireRole(user, "admin", "dispatcher");

    const { error } = await supabase
      .from("alerts")
      .update({ resolved_at: new Date().toISOString(), resolved_by: authed.id })
      .eq("id", alertId);

    if (error) throw toAppError(error);

    revalidatePath("/alerts");
    revalidatePath("/dashboard");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("resolveAlertAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}
