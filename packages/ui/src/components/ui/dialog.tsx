import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "../../lib/utils.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

function DialogOverlay({
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

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          // `glass` replaces the opaque fill rather than stacking on it: both
          // set background-color, and leaving `bg-background` in place would
          // make which one wins depend on Tailwind's utility ordering.
          "fixed left-1/2 top-1/2 z-50 grid -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border glass p-6 shadow-lift",
          // A centered `fixed` box with no height cap overflows off both
          // edges at once and can't be scrolled back — on a phone in
          // landscape, or with the on-screen keyboard open, that puts the
          // footer (Guardar / Eliminar / Aplicar) permanently out of reach.
          // Cap it against the *dynamic* viewport so mobile browser chrome
          // is accounted for, and let the box scroll inside that cap.
          "max-h-[calc(100dvh-2rem)] overflow-y-auto",
          // `w-full` alone leaves the dialog flush against both screen edges
          // below 448px, with its own p-6 touching the bezel.
          "w-[calc(100%-2rem)] max-w-md",
          "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            // Sized as a real target rather than a bare 16px glyph: this is
            // the primary way out of a dialog on touch.
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

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({
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
