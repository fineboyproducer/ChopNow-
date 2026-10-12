"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  requireRole,
  safeParseWithFieldErrors,
  addressSchema,
  toAppError,
  createLogger,
} from "@chopnow/lib";
import type { ApiResponse, Address } from "@chopnow/types";
import type { Database } from "@chopnow/lib/supabase/database.generated";

const log = createLogger("web-address-actions");

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

function mapAddress(row: AddressRow): Address {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    fullAddress: row.full_address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

async function getClientAndUser() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  return { supabase, user };
}

/**
 * Lists the signed-in customer's saved addresses, most-recently-created
 * first, with the default address (if any) pinned to the top regardless
 * of creation order — this is what the checkout address picker and the
 * account/addresses page both read from.
 */
export async function listAddresses(): Promise<ApiResponse<Address[]>> {
  try {
    const { supabase, user } = await getClientAndUser();
    requireRole(user, "customer");

    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw toAppError(error);

    return { success: true, data: (data as AddressRow[]).map(mapAddress) };
  } catch (err) {
    const appError = toAppError(err);
    log.error("listAddresses failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function createAddressAction(
  _prevState: unknown,
  formData: FormData,
): Promise<ApiResponse<Address>> {
  try {
    const { supabase, user } = await getClientAndUser();
    const authed = requireRole(user, "customer");

    const parsed = safeParseWithFieldErrors(addressSchema, {
      label: formData.get("label") || undefined,
      fullAddress: formData.get("fullAddress"),
      lat: Number(formData.get("lat")),
      lng: Number(formData.get("lng")),
      isDefault: formData.get("isDefault") === "true",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Check the address fields.", fieldErrors: parsed.fieldErrors },
      };
    }

    const { data, error } = await supabase
      .from("addresses")
      .insert({
        user_id: authed.id,
        label: parsed.data.label ?? null,
        full_address: parsed.data.fullAddress,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        is_default: parsed.data.isDefault ?? false,
      })
      .select("*")
      .single();

    if (error || !data) throw toAppError(error);

    revalidatePath("/account/addresses");
    revalidatePath("/checkout");

    return { success: true, data: mapAddress(data as AddressRow) };
  } catch (err) {
    const appError = toAppError(err);
    log.error("createAddressAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function deleteAddressAction(addressId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase, user } = await getClientAndUser();
    const authed = requireRole(user, "customer");

    // RLS (addresses_all_own) already scopes this to the caller's own
    // rows, but scoping explicitly here too keeps intent obvious and
    // gives a clearer error path than relying on RLS to silently no-op.
    const { error } = await supabase.from("addresses").delete().eq("id", addressId).eq("user_id", authed.id);
    if (error) throw toAppError(error);

    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("deleteAddressAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function setDefaultAddressAction(addressId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase, user } = await getClientAndUser();
    const authed = requireRole(user, "customer");

    // The trigger `enforce_single_default_address` (0002_addresses.sql)
    // handles un-defaulting any other row automatically.
    const { error } = await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("id", addressId)
      .eq("user_id", authed.id);

    if (error) throw toAppError(error);

    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("setDefaultAddressAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}
