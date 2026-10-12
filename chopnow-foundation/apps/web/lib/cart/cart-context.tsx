"use client";

import * as React from "react";
import type { MockMenuItem, MockRestaurant } from "@/lib/data/restaurant-types";

export interface CartLine {
  itemId: string;
  restaurantId: string;
  restaurantSlug: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  /** Captured from the server-computed MockMenuItem.displayPrice at the
   *  moment the item was added — see packages/lib/supabase/settings.ts.
   *  Recomputing this client-side later (as an earlier version of this
   *  file did, via applyMarkup with no arguments) would silently fall
   *  back to a hardcoded default markup instead of whatever the live
   *  platform_settings value actually is, which could visibly diverge
   *  from what checkout actually charges. Storing the real value at
   *  add-time avoids that class of bug entirely. */
  displayPrice: number;
  qty: number;
  notes: string;
}

interface CartState {
  restaurantId: string | null;
  restaurantName: string | null;
  /** Snapshotted from the restaurant when the cart was started, so the
   *  checkout total is correct even if this module's restaurant lookup
   *  is unavailable at checkout time (e.g. offline). Kept in sync with
   *  the restaurant's current fee on every ADD_ITEM. */
  restaurantDeliveryFee: number;
  lines: CartLine[];
}

type CartAction =
  | { type: "ADD_ITEM"; item: MockMenuItem; restaurant: MockRestaurant }
  | { type: "UPDATE_QTY"; itemId: string; delta: number }
  | { type: "UPDATE_NOTES"; itemId: string; notes: string }
  | { type: "REMOVE_ITEM"; itemId: string }
  | { type: "RESTORE"; state: CartState }
  | { type: "CLEAR" };

const CART_STORAGE_KEY = "chopnow_cart_v1";
const EMPTY_STATE: CartState = {
  restaurantId: null,
  restaurantName: null,
  restaurantDeliveryFee: 0,
  lines: [],
};

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const isDifferentRestaurant = state.restaurantId && state.restaurantId !== action.restaurant.id;
      const baseLines = isDifferentRestaurant ? [] : state.lines;
      const existing = baseLines.find((l) => l.itemId === action.item.id);

      const lines = existing
        ? baseLines.map((l) => (l.itemId === action.item.id ? { ...l, qty: l.qty + 1 } : l))
        : [
            ...baseLines,
            {
              itemId: action.item.id,
              restaurantId: action.restaurant.id,
              restaurantSlug: action.restaurant.slug,
              name: action.item.name,
              imageUrl: action.item.imageUrl,
              basePrice: action.item.basePrice,
              displayPrice: action.item.displayPrice,
              qty: 1,
              notes: "",
            },
          ];

      return {
        restaurantId: action.restaurant.id,
        restaurantName: action.restaurant.name,
        restaurantDeliveryFee: action.restaurant.baseDeliveryFee,
        lines,
      };
    }
    case "UPDATE_QTY": {
      const lines = state.lines
        .map((l) => (l.itemId === action.itemId ? { ...l, qty: Math.max(0, l.qty + action.delta) } : l))
        .filter((l) => l.qty > 0);
      return lines.length === 0 ? EMPTY_STATE : { ...state, lines };
    }
    case "UPDATE_NOTES":
      return {
        ...state,
        lines: state.lines.map((l) => (l.itemId === action.itemId ? { ...l, notes: action.notes } : l)),
      };
    case "REMOVE_ITEM": {
      const lines = state.lines.filter((l) => l.itemId !== action.itemId);
      return lines.length === 0 ? EMPTY_STATE : { ...state, lines };
    }
    case "RESTORE":
      return action.state;
    case "CLEAR":
      return EMPTY_STATE;
  }
}

const SERVICE_FEE = 150;

interface CartContextValue {
  state: CartState;
  addItem: (item: MockMenuItem, restaurant: MockRestaurant) => void;
  updateQty: (itemId: string, delta: number) => void;
  updateNotes: (itemId: string, notes: string) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
  displayPrice: (line: CartLine) => number;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  itemCount: number;
}

const CartContext = React.createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, EMPTY_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  // Persist to localStorage so the cart survives a page refresh — this
  // is a client-only concern; once orders are backed by Supabase, cart
  // state could optionally sync server-side for a signed-in user across
  // devices, but that's out of scope for this sprint's UI-only cart.
  React.useEffect(() => {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CartState;
        if (parsed && Array.isArray(parsed.lines)) {
          dispatch({ type: "RESTORE", state: parsed });
        }
      } catch {
        // Corrupt cart data — ignore and start fresh rather than crash.
      }
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  // Simple accessor for a line's already-computed display price (see
  // CartLine.displayPrice doc comment for why this is captured at
  // add-time rather than recomputed here). Takes the line itself rather
  // than a bare basePrice number, since two different menu items could
  // coincidentally share the same base price and a lookup-by-price would
  // then be ambiguous.
  const displayPrice = React.useCallback((line: CartLine) => line.displayPrice, []);

  const subtotal = state.lines.reduce((sum, l) => sum + l.displayPrice * l.qty, 0);
  const itemCount = state.lines.reduce((sum, l) => sum + l.qty, 0);
  const deliveryFee = itemCount > 0 ? state.restaurantDeliveryFee : 0;
  const serviceFee = itemCount > 0 ? SERVICE_FEE : 0;
  const total = subtotal + deliveryFee + serviceFee;

  const value: CartContextValue = {
    state,
    addItem: (item, restaurant) => dispatch({ type: "ADD_ITEM", item, restaurant }),
    updateQty: (itemId, delta) => dispatch({ type: "UPDATE_QTY", itemId, delta }),
    updateNotes: (itemId, notes) => dispatch({ type: "UPDATE_NOTES", itemId, notes }),
    removeItem: (itemId) => dispatch({ type: "REMOVE_ITEM", itemId }),
    clear: () => dispatch({ type: "CLEAR" }),
    displayPrice,
    subtotal,
    deliveryFee,
    serviceFee,
    total,
    itemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

export { SERVICE_FEE };
