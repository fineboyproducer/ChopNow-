"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  requireRole,
  safeParseWithFieldErrors,
  restaurantSchema,
  toAppError,
  AppError,
  createLogger,
} from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";
import type { Database } from "@chopnow/lib/supabase/database.generated";

type RestaurantUpdate = Database["public"]["Tables"]["restaurants"]["Update"];

const log = createLogger("admin-restaurant-actions");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Admin or dispatcher — used for most restaurant management actions. */
async function getClientAndStaff() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  const authed = requireRole(user, "admin", "dispatcher");
  return { supabase, authed };
}

/** Admin only — used for actions dispatchers shouldn't be able to perform (e.g. deletion). */
async function getClientAndAdminOnly() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  const authed = requireRole(user, "admin");
  return { supabase, authed };
}

export async function createRestaurantAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ApiResponse<{ id: string; slug: string }>> {
  try {
    const { supabase, authed } = await getClientAndStaff();

    const parsed = safeParseWithFieldErrors(restaurantSchema, {
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      category: formData.get("category") || undefined,
      phone: formData.get("phone"),
      address: formData.get("address"),
      lat: Number(formData.get("lat")),
      lng: Number(formData.get("lng")),
      baseDeliveryFee: Number(formData.get("baseDeliveryFee")),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors },
      };
    }

    const baseSlug = slugify(parsed.data.name);
    let slug = baseSlug;
    let attempt = 0;
    // Guard against slug collisions (two restaurants with the same name)
    // by appending a numeric suffix rather than failing the whole
    // onboarding flow — per PRD Section 7.9, restaurant onboarding
    // should be fast and admin-friendly, not blocked by an edge case
    // like a duplicate trading name across different locations.
    for (;;) {
      const { data: existing } = await supabase.from("restaurants").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
      if (attempt > 50) throw AppError.internal("Could not generate a unique restaurant slug.");
    }

    const { data, error } = await supabase
      .from("restaurants")
      .insert({
        name: parsed.data.name,
        slug,
        description: parsed.data.description ?? null,
        category: parsed.data.category ?? null,
        phone: parsed.data.phone,
        address: parsed.data.address,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        base_delivery_fee: parsed.data.baseDeliveryFee,
        status: "offline",
        created_by: authed.id,
      })
      .select("id, slug")
      .single();

    if (error || !data) throw toAppError(error);

    revalidatePath("/restaurants");
    return { success: true, data };
  } catch (err) {
    const appError = toAppError(err);
    log.error("createRestaurantAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export interface UpdateRestaurantInput {
  restaurantId: string;
  name?: string;
  description?: string;
  category?: string;
  phone?: string;
  address?: string;
  baseDeliveryFee?: number;
  markupPercentOverride?: number | null;
}

export async function updateRestaurantAction(input: UpdateRestaurantInput): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();

    const updatePayload: RestaurantUpdate = {};
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.category !== undefined) updatePayload.category = input.category;
    if (input.phone !== undefined) updatePayload.phone = input.phone;
    if (input.address !== undefined) updatePayload.address = input.address;
    if (input.baseDeliveryFee !== undefined) updatePayload.base_delivery_fee = input.baseDeliveryFee;
    if (input.markupPercentOverride !== undefined) updatePayload.markup_percent_override = input.markupPercentOverride;

    if (Object.keys(updatePayload).length === 0) {
      return { success: true, data: null };
    }

    const { error } = await supabase.from("restaurants").update(updatePayload).eq("id", input.restaurantId);
    if (error) throw toAppError(error);

    revalidatePath("/restaurants");
    revalidatePath(`/restaurants/${input.restaurantId}`);
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("updateRestaurantAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function setRestaurantStatusAction(
  restaurantId: string,
  status: "open" | "busy" | "offline",
): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();
    const { error } = await supabase.from("restaurants").update({ status }).eq("id", restaurantId);
    if (error) throw toAppError(error);

    revalidatePath("/restaurants");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("setRestaurantStatusAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function setRestaurantFeaturedAction(restaurantId: string, isFeatured: boolean): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();
    const { error } = await supabase.from("restaurants").update({ is_featured: isFeatured }).eq("id", restaurantId);
    if (error) throw toAppError(error);

    revalidatePath("/restaurants");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("setRestaurantFeaturedAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

/**
 * Deletes a restaurant only if it has no orders on record — restaurants
 * with order history are deactivated (status: offline) instead, since
 * deleting them would orphan or cascade-delete real transaction history
 * that the business, customers, and analytics all depend on. Admin-only
 * (not dispatcher), since deletion is destructive and irreversible in a
 * way status changes aren't.
 */
export async function deleteRestaurantAction(restaurantId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndAdminOnly();

    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId);

    if (count && count > 0) {
      throw AppError.conflict(
        "This restaurant has order history and can't be deleted. Set it to Offline instead to remove it from customer discovery.",
      );
    }

    const { error } = await supabase.from("restaurants").delete().eq("id", restaurantId);
    if (error) throw toAppError(error);

    revalidatePath("/restaurants");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("deleteRestaurantAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}
