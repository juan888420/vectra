import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../../lib/utils.js";
import { buttonVariants } from "./button.js";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/50",
        "data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
        className,
      )}
      {...props}
    />
  );
}

export function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        className={cn(
          // Same glass surface as DialogContent — see the note there on why
          // the opaque fill is replaced rather than layered under it.
          "fixed left-1/2 top-1/2 z-50 grid -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border glass p-6 shadow-lift",
          // Same height/width contract as DialogContent — see the note
          // there. An alert dialog can grow too: ScenarioImpactDialog lists
          // one row per pending change.
          "max-h-[calc(100dvh-2rem)] overflow-y-auto",
          "w-[calc(100%-2rem)] max-w-md",
          "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/** The confirming action. `variant` is opt-in rather than defaulted to
 * destructive, because an alert dialog isn't always a deletion — the scenario
 * sync prompt confirms with "Aplicar ahora". Deletions pass
 * `variant="destructive"` so the button that does the irreversible thing
 * stops looking like the app's primary call to action. */
export function AlertDialogAction({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
  Pick<VariantProps<typeof buttonVariants>, "variant">) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  );
}
