"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@chopnow/lib";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
  />
));
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName;

const drawerContentVariants = cva(
  "fixed z-50 flex flex-col bg-card shadow-2xl transition-transform data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-full border-l border-border sm:max-w-md data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
        left: "inset-y-0 left-0 h-full w-full border-r border-border sm:max-w-md data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
        bottom:
          "inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t border-border data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerContentVariants> {}

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ side, className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(drawerContentVariants({ side }), className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DrawerContent.displayName = DialogPrimitive.Content.displayName;

export function DrawerHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border px-5 py-4",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="rounded-full bg-muted p-2 text-foreground/70 transition-colors hover:bg-muted/70">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </div>
  );
}

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-bold text-foreground", className)}
    {...props}
  />
));
DrawerTitle.displayName = DialogPrimitive.Title.displayName;

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-t border-border bg-muted/40 px-5 py-4", className)} {...props} />
  );
}
