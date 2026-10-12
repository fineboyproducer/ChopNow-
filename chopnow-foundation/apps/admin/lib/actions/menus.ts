"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  requireRole,
  safeParseWithFieldErrors,
  menuItemSchema,
  toAppError,
  createLogger,
} from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";
import type { Database } from "@chopnow/lib/supabase/database.generated";

type MenuItemUpdate = Database["public"]["Tables"]["menu_items"]["Update"];

const log = createLogger("admin-menu-actions");

async function getClientAndStaff() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  const authed = requireRole(user, "admin", "dispatcher");
  return { supabase, authed };
}

export async function createMenuCategoryAction(restaurantId: string, name: string): Promise<ApiResponse<{ id: string }>> {
  try {
    const { supabase } = await getClientAndStaff();

    if (!name.trim()) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: "Category name is required." } };
    }

    const { count } = await supabase
      .from("menu_categories")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId);

    const { data, error } = await supabase
      .from("menu_categories")
      .insert({ restaurant_id: restaurantId, name: name.trim(), sort_order: count ?? 0 })
      .select("id")
      .single();

    if (error || !data) throw toAppError(error);

    revalidatePath(`/menus/${restaurantId}`);
    return { success: true, data };
  } catch (err) {
    const appError = toAppError(err);
    log.error("createMenuCategoryAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function deleteMenuCategoryAction(restaurantId: string, categoryId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();
    // Items in this category are not deleted — their category_id is set
    // to null by the FK's ON DELETE SET NULL (see 0003_restaurants_and_menu.sql),
    // so removing a category never silently deletes menu items.
    const { error } = await supabase.from("menu_categories").delete().eq("id", categoryId);
    if (error) throw toAppError(error);

    revalidatePath(`/menus/${restaurantId}`);
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("deleteMenuCategoryAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export interface CreateMenuItemInput {
  restaurantId: string;
  categoryId?: string;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
}

export async function createMenuItemAction(input: CreateMenuItemInput): Promise<ApiResponse<{ id: string }>> {
  try {
    const { supabase } = await getClientAndStaff();

    const parsed = safeParseWithFieldErrors(menuItemSchema, {
      name: input.name,
      description: input.description,
      basePrice: input.basePrice,
      categoryId: input.categoryId,
      isAvailable: true,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors },
      };
    }

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        restaurant_id: input.restaurantId,
        category_id: input.categoryId ?? null,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        base_price: parsed.data.basePrice,
        image_url: input.imageUrl ?? null,
        is_available: true,
      })
      .select("id")
      .single();

    if (error || !data) throw toAppError(error);

    revalidatePath(`/menus/${input.restaurantId}`);
    return { success: true, data };
  } catch (err) {
    const appError = toAppError(err);
    log.error("createMenuItemAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export interface UpdateMenuItemInput {
  itemId: string;
  restaurantId: string;
  name?: string;
  description?: string;
  basePrice?: number;
  categoryId?: string | null;
}

export async function updateMenuItemAction(input: UpdateMenuItemInput): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();

    const updatePayload: MenuItemUpdate = {};
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.basePrice !== undefined) updatePayload.base_price = input.basePrice;
    if (input.categoryId !== undefined) updatePayload.category_id = input.categoryId;

    const { error } = await supabase.from("menu_items").update(updatePayload).eq("id", input.itemId);
    if (error) throw toAppError(error);

    revalidatePath(`/menus/${input.restaurantId}`);
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("updateMenuItemAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function setMenuItemAvailabilityAction(
  itemId: string,
  restaurantId: string,
  isAvailable: boolean,
): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();
    const { error } = await supabase.from("menu_items").update({ is_available: isAvailable }).eq("id", itemId);
    if (error) throw toAppError(error);

    revalidatePath(`/menus/${restaurantId}`);
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("setMenuItemAvailabilityAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function deleteMenuItemAction(itemId: string, restaurantId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();

    // Menu items referenced by past order_items (via menu_item_id) are
    // never actually deleted from history, since order_items snapshots
    // name/price at purchase time independent of the live menu_items row
    // (PRD Section 7.1). See migrations/0005_fix_order_items_menu_item_fk.sql:
    // the FK is ON DELETE SET NULL, so deleting a menu item here can
    // never fail due to — or corrupt — past order history.
    const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
    if (error) throw toAppError(error);

    revalidatePath(`/menus/${restaurantId}`);
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("deleteMenuItemAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}
