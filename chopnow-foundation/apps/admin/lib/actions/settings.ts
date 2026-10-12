"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  requireRole,
  toAppError,
  createLogger,
} from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";

const log = createLogger("admin-settings-actions");

/**
 * Admin-only (not dispatcher) — global markup is a business-critical
 * pricing lever affecting every restaurant without an override (PRD
 * Section 7.1), so it's deliberately scoped tighter than restaurant/menu
 * management, which dispatchers can also perform.
 */
export async function updateGlobalMarkupAction(_prevState: unknown, formData: FormData): Promise<ApiResponse<null>> {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const user = await getAuthenticatedUser(supabase);
    requireRole(user, "admin");

    const value = Number(formData.get("markupPercent"));
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Markup must be a number between 0 and 100." },
      };
    }

    const { error } = await supabase
      .from("platform_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", "global_markup_percent");

    if (error) throw toAppError(error);

    revalidatePath("/settings");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("updateGlobalMarkupAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}
