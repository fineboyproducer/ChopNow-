"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button, Card, FormField, Input } from "@chopnow/ui";
import type { ApiResponse } from "@chopnow/types";
import { createRestaurantAction } from "@/lib/actions/restaurants";

const initialState: ApiResponse<{ id: string; slug: string }> = { success: true, data: { id: "", slug: "" } };

// Ekpoma town-center default — see the same note in apps/web's address
// form: once real geocoding is wired in, this should be replaced by an
// address-autocomplete input that returns real coordinates.
const DEFAULT_LAT = 6.7433;
const DEFAULT_LNG = 6.137;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating restaurant..." : "Create restaurant"}
    </Button>
  );
}

export function NewRestaurantForm() {
  const router = useRouter();
  const [state, formAction] = useFormState(createRestaurantAction, initialState);
  const fieldErrors = !state.success ? state.error.fieldErrors ?? {} : {};

  React.useEffect(() => {
    if (state.success && state.data.id) {
      router.push(`/restaurants/${state.data.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="lat" value={DEFAULT_LAT} />
        <input type="hidden" name="lng" value={DEFAULT_LNG} />

        <FormField label="Restaurant name" htmlFor="name" error={fieldErrors.name} required>
          <Input id="name" name="name" placeholder="Mama Ekpoma Kitchen" required />
        </FormField>

        <FormField label="Category" htmlFor="category" error={fieldErrors.category} hint="e.g. Nigerian Food, Fast Food, Shawarma">
          <Input id="category" name="category" placeholder="Nigerian Food" />
        </FormField>

        <FormField label="Description" htmlFor="description" error={fieldErrors.description}>
          <Input id="description" name="description" placeholder="Home-style jollof and native soups." />
        </FormField>

        <FormField label="Phone number" htmlFor="phone" error={fieldErrors.phone} required>
          <Input id="phone" name="phone" type="tel" placeholder="08031234567" required />
        </FormField>

        <FormField label="Address" htmlFor="address" error={fieldErrors.address} required>
          <Input id="address" name="address" placeholder="Along EUC Road, Ekpoma" required />
        </FormField>

        <FormField
          label="Base delivery fee (₦)"
          htmlFor="baseDeliveryFee"
          error={fieldErrors.baseDeliveryFee}
          required
        >
          <Input id="baseDeliveryFee" name="baseDeliveryFee" type="number" min={0} step={50} defaultValue={400} required />
        </FormField>

        {!state.success && !state.error.fieldErrors && (
          <p className="text-[13px] font-medium text-destructive">{state.error.message}</p>
        )}

        <SubmitButton />
      </form>
    </Card>
  );
}
