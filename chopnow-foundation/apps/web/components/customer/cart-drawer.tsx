"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  Button,
  EmptyState,
} from "@chopnow/ui";
import { formatNaira } from "@chopnow/lib";
import { useCart } from "@/lib/cart/cart-context";

export function CartDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { state, updateQty, updateNotes, displayPrice, subtotal, deliveryFee, serviceFee, total } = useCart();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <ShoppingBag size={18} /> Your cart
          </DrawerTitle>
        </DrawerHeader>

        {state.lines.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={ShoppingBag}
              title="Your cart is empty"
              description="Add dishes from a restaurant to get started."
              action={
                <Button variant="ghost" onClick={() => onOpenChange(false)} asChild>
                  <Link href="/discover">Browse restaurants</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <DrawerBody>
              {state.restaurantName && (
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {state.restaurantName}
                </p>
              )}
              <div className="space-y-4">
                {state.lines.map((line) => (
                  <div key={line.itemId} className="flex gap-3">
                    {line.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={line.imageUrl}
                        alt={line.name}
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-foreground">{line.name}</p>
                      <p className="mt-0.5 text-[13px] font-bold text-primary">
                        {formatNaira(displayPrice(line))}
                      </p>
                      <input
                        defaultValue={line.notes}
                        onBlur={(e) => updateNotes(line.itemId, e.target.value)}
                        placeholder="Special instructions"
                        className="mt-1.5 w-full rounded-lg bg-muted px-2.5 py-1.5 text-[11px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="flex shrink-0 items-start">
                      <div className="flex items-center gap-1 rounded-full bg-muted px-1 py-1">
                        <button
                          onClick={() => updateQty(line.itemId, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-sm"
                          aria-label={`Decrease ${line.name} quantity`}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-4 text-center text-[12px] font-bold">{line.qty}</span>
                        <button
                          onClick={() => updateQty(line.itemId, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-sm"
                          aria-label={`Increase ${line.name} quantity`}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DrawerBody>

            <DrawerFooter>
              <div className="mb-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">{formatNaira(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery fee</span>
                  <span className="font-semibold text-foreground">{formatNaira(deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Service fee</span>
                  <span className="font-semibold text-foreground">{formatNaira(serviceFee)}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-border pt-2 text-[15px] font-extrabold text-foreground">
                  <span>Total</span>
                  <span>{formatNaira(total)}</span>
                </div>
              </div>
              <Button
                className="w-full py-3.5 text-[15px]"
                onClick={() => {
                  onOpenChange(false);
                  router.push("/checkout");
                }}
              >
                Go to checkout
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
