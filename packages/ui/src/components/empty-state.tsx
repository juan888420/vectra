import type { ComponentType, ReactNode } from "react";

import { cn } from "../lib/utils.js";

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        // py-16 everywhere made an empty state fill most of a phone screen,
        // and the composer stacks three of them under a min-h-40 each.
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center sm:py-16",
        className,
      )}
    >
      {Icon ? <Icon className="size-8 text-muted-foreground" /> : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-balance">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground text-balance">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
