import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "../../lib/utils.js";

/** A panel anchored to the edge of the screen, built on the same Radix Dialog
 * as `Dialog` — so it inherits the focus trap, Esc-to-close, scroll lock and
 * `aria-modal` semantics a hand-rolled drawer would have to re-implement and
 * usually gets wrong. Added for the scenarios sidebar on narrow viewports
 * (RFC-0028), where a 16rem column alongside the detail panel leaves nothing
 * for the detail itself. No new dependency: @radix-ui/react-dialog was
 * already here for Dialog. */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/50",
        "data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
        className,
      )}
      {...props}
    />
  );
}

export interface SheetContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /** Only "left" is implemented — it's the one the scenarios list needs, and
   * an unused "right"/"bottom" variant would be dead code carrying its own
   * keyframes. Add a side when something actually calls for it. */
  side?: "left";
}

export function SheetContent({ className, children, side = "left", ...props }: SheetContentProps) {
  void side;
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col border-r bg-card shadow-lg",
          "data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute right-3 top-3 flex size-8 items-center justify-center rounded-md text-muted-foreground",
            "opacity-70 transition-opacity hover:bg-accent hover:opacity-100 focus-ring",
          )}
        >
          <X className="size-4" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1 border-b px-4 py-3 pr-14", className)} {...props} />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
