import type * as React from "react";

import { cn } from "../../lib/utils.js";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        // 16px on touch viewports, 14px from md up: Safari iOS zooms into any
        // input whose font is under 16px and leaves the page zoomed.
        "text-base md:text-sm",
        "focus-ring",
        className,
      )}
      {...props}
    />
  );
}
