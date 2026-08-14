import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type * as React from "react";

import { cn } from "../../lib/utils.js";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
        // 16px on touch viewports: Safari iOS zooms into any control with a
        // smaller font and never zooms back out.
        "text-base md:text-sm",
        // The value can be a long category or scenario name — let it clip
        // rather than push the chevron out of the trigger.
        "[&>span]:min-w-0 [&>span]:truncate",
        "focus-ring",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          // `text-popover-foreground` stays: `glass` only owns the surface
          // (fill, blur, edge), never the text colour on it.
          "relative z-50 min-w-32 overflow-hidden rounded-md border glass text-popover-foreground shadow-lift",
          // Every list in the app is fetched with `pageSize: 100`, so an
          // uncapped dropdown can run past the bottom of the viewport with no
          // way to reach the last option. Radix measures the room actually
          // available and exposes it here; 24rem keeps it from swallowing a
          // tall desktop screen.
          "max-h-[min(24rem,var(--radix-select-content-available-height))] overflow-y-auto",
          "data-[state=open]:animate-popover-in data-[state=closed]:animate-popover-out",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        {/* No `h-[--radix-select-trigger-height]` here: that pins the list to
            the trigger's own height (~36px) instead of letting it size to its
            options. The width floor is the useful half of that pairing. */}
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        // py-2 rather than py-1.5: ~36px rows are comfortably tappable in a
        // list that is often scrolled with a thumb.
        "relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
