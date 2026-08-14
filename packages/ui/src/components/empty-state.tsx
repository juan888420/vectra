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
        //
        // A filled panel rather than the dashed outline it used to be: a
        // dashed border reads as a drop target or an unfinished wireframe,
        // which is the wrong signal for a state the user reaches on every
        // fresh scenario. The tint is faint enough that `--foreground` and
        // `--muted-foreground` both stay above 4.5:1 on top of it.
        "flex flex-col items-center justify-center gap-3 rounded-xl border bg-muted/40 px-4 py-10 text-center sm:py-16",
        className,
      )}
    >
      {Icon ? (
        // The icon gets its own disc so it reads as an illustration rather
        // than a stray glyph floating above the text.
        <span className="flex size-12 items-center justify-center rounded-full bg-background/70">
          <Icon className="size-5 text-muted-foreground" />
        </span>
      ) : null}
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
