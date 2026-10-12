"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Card, Button, Input, FormField } from "@chopnow/ui";
import { cn, formatNaira } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import {
  createMenuCategoryAction,
  deleteMenuCategoryAction,
  createMenuItemAction,
  updateMenuItemAction,
  setMenuItemAvailabilityAction,
  deleteMenuItemAction,
} from "@/lib/actions/menus";

type MenuCategoryRow = Database["public"]["Tables"]["menu_categories"]["Row"];
type MenuItemRowType = Database["public"]["Tables"]["menu_items"]["Row"];

function AddCategoryForm({ restaurantId }: { restaurantId: string }) {
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    const result = await createMenuCategoryAction(restaurantId, name);
    setPending(false);
    if (result.success) setName("");
    else setError(result.error.message);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New category name (e.g. Rice)"
        className="flex-1"
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <Button size="sm" onClick={handleAdd} disabled={pending || !name.trim()}>
        <Plus size={14} /> Add
      </Button>
      {error && <p className="text-[11.5px] text-destructive">{error}</p>}
    </div>
  );
}

function AddItemForm({
  restaurantId,
  categories,
  onClose,
}: {
  restaurantId: string;
  categories: MenuCategoryRow[];
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [basePrice, setBasePrice] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    setPending(true);
    setError(null);
    const result = await createMenuItemAction({
      restaurantId,
      categoryId: categoryId || undefined,
      name,
      description: description || undefined,
      basePrice: Number(basePrice),
    });
    setPending(false);
    if (result.success) onClose();
    else setError(result.error.message);
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Add menu item</p>
        <button onClick={onClose} className="rounded-full bg-muted p-1.5">
          <X size={13} />
        </button>
      </div>
      <div className="space-y-3">
        <FormField label="Name" htmlFor="itemName" required>
          <Input id="itemName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jollof Rice + Chicken" />
        </FormField>
        <FormField label="Description" htmlFor="itemDescription">
          <Input id="itemDescription" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField label="Base price (₦)" htmlFor="itemPrice" required hint="The restaurant's own price, before ChopNow's markup.">
          <Input id="itemPrice" type="number" min={1} step={50} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
        </FormField>
        {categories.length > 0 && (
          <div>
            <label className="mb-1 block text-[13px] font-semibold text-foreground">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && <p className="text-[12.5px] font-medium text-destructive">{error}</p>}
        <Button onClick={handleSubmit} disabled={pending || !name.trim() || !basePrice} className="w-full">
          {pending ? "Adding..." : "Add item"}
        </Button>
      </div>
    </Card>
  );
}

function MenuItemEditableRow({
  item,
  restaurantId,
}: {
  item: MenuItemRowType;
  restaurantId: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(item.name);
  const [basePrice, setBasePrice] = React.useState(item.base_price);
  const [available, setAvailable] = React.useState(item.is_available);
  const [saving, setSaving] = React.useState(false);

  const handleToggleAvailable = async () => {
    const next = !available;
    setAvailable(next);
    const result = await setMenuItemAvailabilityAction(item.id, restaurantId, next);
    if (!result.success) setAvailable(!next);
  };

  const handleSave = async () => {
    setSaving(true);
    await updateMenuItemAction({ itemId: item.id, restaurantId, name, basePrice: Number(basePrice) });
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await deleteMenuItemAction(item.id, restaurantId);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border p-2.5">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Input
          type="number"
          value={basePrice}
          onChange={(e) => setBasePrice(Number(e.target.value))}
          className="w-24"
        />
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "..." : "Save"}
        </Button>
        <button onClick={() => setEditing(false)} className="rounded-full bg-muted p-1.5">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-lg p-2.5 transition-colors", !available && "opacity-60")}>
      <button onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left" title="Click to edit">
        <p className="truncate text-[13px] font-bold text-foreground">{item.name}</p>
        <p className="text-[11px] text-muted-foreground">{formatNaira(item.base_price)} base price</p>
      </button>
      <button
        onClick={handleToggleAvailable}
        className={cn(
          "rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors",
          available ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        )}
      >
        {available ? "Available" : "Sold out"}
      </button>
      <button onClick={handleDelete} className="rounded-full p-1.5 text-destructive/70 hover:bg-destructive/10">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export function MenuManagementClient({
  restaurantId,
  initialCategories,
  initialItems,
}: {
  restaurantId: string;
  initialCategories: MenuCategoryRow[];
  initialItems: MenuItemRowType[];
}) {
  const [showAddItem, setShowAddItem] = React.useState(false);

  const itemsByCategory = new Map<string | null, MenuItemRowType[]>();
  for (const item of initialItems) {
    const key = item.category_id;
    if (!itemsByCategory.has(key)) itemsByCategory.set(key, []);
    itemsByCategory.get(key)!.push(item);
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Categories</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {initialCategories.map((cat) => (
            <span
              key={cat.id}
              className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12px] font-bold text-foreground"
            >
              {cat.name}
              <button
                onClick={() => deleteMenuCategoryAction(restaurantId, cat.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {initialCategories.length === 0 && (
            <p className="text-[12.5px] text-muted-foreground">No categories yet — add one below.</p>
          )}
        </div>
        <AddCategoryForm restaurantId={restaurantId} />
      </Card>

      {initialCategories.map((cat) => (
        <Card key={cat.id} className="p-4">
          <p className="mb-3 text-[12.5px] font-extrabold text-foreground">{cat.name}</p>
          <div className="space-y-1.5">
            {(itemsByCategory.get(cat.id) ?? []).map((item) => (
              <MenuItemEditableRow key={item.id} item={item} restaurantId={restaurantId} />
            ))}
            {(itemsByCategory.get(cat.id) ?? []).length === 0 && (
              <p className="py-3 text-center text-[12px] text-muted-foreground">No items in this category yet.</p>
            )}
          </div>
        </Card>
      ))}

      {itemsByCategory.has(null) && (
        <Card className="p-4">
          <p className="mb-3 text-[12.5px] font-extrabold text-foreground">Uncategorized</p>
          <div className="space-y-1.5">
            {itemsByCategory.get(null)!.map((item) => (
              <MenuItemEditableRow key={item.id} item={item} restaurantId={restaurantId} />
            ))}
          </div>
        </Card>
      )}

      {showAddItem ? (
        <AddItemForm restaurantId={restaurantId} categories={initialCategories} onClose={() => setShowAddItem(false)} />
      ) : (
        <Button variant="ghost" className="w-full py-3" onClick={() => setShowAddItem(true)}>
          <Plus size={15} /> Add menu item
        </Button>
      )}
    </div>
  );
}
