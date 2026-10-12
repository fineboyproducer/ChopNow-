"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Trash2, UtensilsCrossed } from "lucide-react";
import { Card, Button, FormField, Input } from "@chopnow/ui";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import {
  updateRestaurantAction,
  setRestaurantFeaturedAction,
  deleteRestaurantAction,
} from "@/lib/actions/restaurants";
import { RestaurantStatusToggle } from "../restaurant-status-toggle";

type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

export function RestaurantDetailClient({
  restaurant,
  orderCount,
  menuItemCount,
}: {
  restaurant: RestaurantRow;
  orderCount: number;
  menuItemCount: number;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(restaurant.name);
  const [category, setCategory] = React.useState(restaurant.category ?? "");
  const [description, setDescription] = React.useState(restaurant.description ?? "");
  const [phone, setPhone] = React.useState(restaurant.phone ?? "");
  const [address, setAddress] = React.useState(restaurant.address ?? "");
  const [baseDeliveryFee, setBaseDeliveryFee] = React.useState(restaurant.base_delivery_fee);
  const [markupOverride, setMarkupOverride] = React.useState(
    restaurant.markup_percent_override != null ? String(restaurant.markup_percent_override) : "",
  );
  const [isFeatured, setIsFeatured] = React.useState(restaurant.is_featured);
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    const result = await updateRestaurantAction({
      restaurantId: restaurant.id,
      name,
      category,
      description,
      phone,
      address,
      baseDeliveryFee: Number(baseDeliveryFee),
      markupPercentOverride: markupOverride.trim() === "" ? null : Number(markupOverride),
    });
    setSaving(false);
    setSaveMessage(result.success ? "Saved." : result.error.message);
  };

  const handleToggleFeatured = async () => {
    const next = !isFeatured;
    setIsFeatured(next); // optimistic
    const result = await setRestaurantFeaturedAction(restaurant.id, next);
    if (!result.success) setIsFeatured(!next);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${restaurant.name}? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteRestaurantAction(restaurant.id);
    setDeleting(false);
    if (result.success) router.push("/restaurants");
    else setDeleteError(result.error.message);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-foreground">{restaurant.name}</h1>
          <p className="text-[12px] text-muted-foreground">
            {menuItemCount} menu item{menuItemCount !== 1 ? "s" : ""} · {orderCount} order
            {orderCount !== 1 ? "s" : ""} on record
          </p>
        </div>
        <button
          onClick={handleToggleFeatured}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
            isFeatured ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Star size={12} className={isFeatured ? "fill-current" : ""} /> {isFeatured ? "Featured" : "Feature"}
        </button>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Availability</p>
        <RestaurantStatusToggle restaurantId={restaurant.id} currentStatus={restaurant.status} />
      </Card>

      <Card className="p-4 space-y-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Restaurant details</p>

        <FormField label="Name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Category" htmlFor="category">
          <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </FormField>
        <FormField label="Description" htmlFor="description">
          <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label="Address" htmlFor="address">
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </FormField>
        <FormField label="Base delivery fee (₦)" htmlFor="baseDeliveryFee">
          <Input
            id="baseDeliveryFee"
            type="number"
            min={0}
            step={50}
            value={baseDeliveryFee}
            onChange={(e) => setBaseDeliveryFee(Number(e.target.value))}
          />
        </FormField>
        <FormField
          label="Markup override (%)"
          htmlFor="markupOverride"
          hint="Leave blank to use the global markup percentage (see Settings)."
        >
          <Input
            id="markupOverride"
            type="number"
            min={0}
            max={100}
            step={0.5}
            placeholder="Global default"
            value={markupOverride}
            onChange={(e) => setMarkupOverride(e.target.value)}
          />
        </FormField>

        {saveMessage && (
          <p className={`text-[12.5px] font-medium ${saveMessage === "Saved." ? "text-success" : "text-destructive"}`}>
            {saveMessage}
          </p>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </Card>

      <Link
        href={`/menus/${restaurant.id}`}
        className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-[13px] font-bold text-foreground transition-colors hover:bg-muted"
      >
        <UtensilsCrossed size={15} /> Manage menu ({menuItemCount})
      </Link>

      <Card className="border-destructive/30 p-4">
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-destructive">Danger zone</p>
        <p className="mb-3 text-[12px] text-muted-foreground">
          {orderCount > 0
            ? "This restaurant has order history and can't be deleted. Set it to Offline above instead."
            : "Deleting a restaurant is permanent and cannot be undone."}
        </p>
        {deleteError && <p className="mb-2 text-[12.5px] font-medium text-destructive">{deleteError}</p>}
        <Button variant="destructive" onClick={handleDelete} disabled={deleting || orderCount > 0} className="w-full">
          <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete restaurant"}
        </Button>
      </Card>
    </div>
  );
}
