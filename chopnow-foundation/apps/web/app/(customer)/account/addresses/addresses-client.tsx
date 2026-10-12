"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Home, Plus, Star, Trash2, X } from "lucide-react";
import { Card, Button, Input, FormField } from "@chopnow/ui";
import type { Address, ApiResponse } from "@chopnow/types";
import { createAddressAction, deleteAddressAction, setDefaultAddressAction, listAddresses } from "@/lib/actions/addresses";

// Ekpoma town-center reference coordinates — used as a default when the
// person doesn't have precise lat/lng for their address. Once a real
// geocoding integration (Mapbox/Google) is wired in, this form's lat/lng
// fields should be replaced by an autocomplete input that returns real
// coordinates instead of asking the person to type them.
const DEFAULT_LAT = 6.7433;
const DEFAULT_LNG = 6.137;

const initialCreateState: ApiResponse<Address> = { success: true, data: {} as Address };

function AddAddressForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [state, formAction] = useFormState(createAddressAction, initialCreateState);
  const fieldErrors = !state.success ? state.error.fieldErrors ?? {} : {};
  const { pending } = useFormStatus();

  React.useEffect(() => {
    if (state.success && state.data && "id" in state.data && state.data.id) onCreated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
          Add a new address
        </p>
        <button onClick={onCancel} className="rounded-full bg-muted p-1.5">
          <X size={13} />
        </button>
      </div>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="lat" value={DEFAULT_LAT} />
        <input type="hidden" name="lng" value={DEFAULT_LNG} />

        <FormField label="Label" htmlFor="label" hint="e.g. Home, Hostel, Office">
          <Input id="label" name="label" placeholder="Hostel" />
        </FormField>

        <FormField label="Full address" htmlFor="fullAddress" error={fieldErrors.fullAddress} required>
          <Input id="fullAddress" name="fullAddress" placeholder="Hostel B, EUC Road, Ekpoma" required />
        </FormField>

        <label className="flex items-center gap-2 text-[12.5px] text-foreground">
          <input type="checkbox" name="isDefault" value="true" className="h-4 w-4 rounded" />
          Set as default address
        </label>

        {!state.success && !state.error.fieldErrors && (
          <p className="text-[12.5px] font-medium text-destructive">{state.error.message}</p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving..." : "Save address"}
        </Button>
      </form>
    </Card>
  );
}

export function AddressesClient({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = React.useState(initialAddresses);
  const [showForm, setShowForm] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const result = await listAddresses();
    if (result.success) setAddresses(result.data);
  }, []);

  const handleDelete = async (id: string) => {
    setPendingDeleteId(id);
    const result = await deleteAddressAction(id);
    setPendingDeleteId(null);
    if (result.success) setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSetDefault = async (id: string) => {
    const result = await setDefaultAddressAction(id);
    if (result.success) {
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
    }
  };

  return (
    <div className="space-y-3">
      {addresses.length === 0 && !showForm && (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          You have no saved addresses yet.
        </p>
      )}

      {addresses.map((address) => (
        <Card key={address.id} className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
            <Home size={15} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-foreground">{address.label || "Address"}</p>
            <p className="text-[11px] text-muted-foreground">{address.fullAddress}</p>
          </div>
          {address.isDefault ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
              Default
            </span>
          ) : (
            <button
              onClick={() => handleSetDefault(address.id)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              title="Set as default"
            >
              <Star size={14} />
            </button>
          )}
          <button
            onClick={() => handleDelete(address.id)}
            disabled={pendingDeleteId === address.id}
            className="rounded-full p-1.5 text-destructive/70 hover:bg-destructive/10"
            title="Delete address"
          >
            <Trash2 size={14} />
          </button>
        </Card>
      ))}

      {showForm ? (
        <AddAddressForm
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Button variant="ghost" className="w-full py-3 text-sm" onClick={() => setShowForm(true)}>
          <Plus size={15} /> Add new address
        </Button>
      )}
    </div>
  );
}
