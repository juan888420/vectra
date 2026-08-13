import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../../lib/utils.js";

// Pressing a button should feel like it took the press (RFC-0029 visual).
// Three cues fire together on `:active`: the surface shrinks 3%, its elevation
// collapses to the pressed shadow, and the fill darkens a step.
//
// The transition names its properties instead of using `transition-all`, which
// would also animate colour-scheme and layout-adjacent properties on every
// state change. 120ms is deliberately below the ~150ms where a press starts to
// feel reported rather than felt. Reduced motion is handled globally in
// index.css, which collapses every duration — the button needs nothing extra.
//
// `disabled` sets pointer-events-none, so the active state can't be reached
// while disabled and needs no separate reset.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,background-color,box-shadow,color] duration-[120ms] ease-physical active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-ring [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-surface hover:bg-primary/90 hover:shadow-lift active:bg-primary/95 active:shadow-press",
        destructive:
          "bg-destructive text-destructive-foreground shadow-surface hover:bg-destructive/90 hover:shadow-lift active:bg-destructive/95 active:shadow-press",
        outline:
          "border border-input bg-card shadow-press hover:bg-accent hover:text-accent-foreground hover:shadow-surface active:shadow-press",
        secondary:
          "bg-secondary text-secondary-foreground shadow-press hover:bg-secondary/80 hover:shadow-surface active:shadow-press",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        // Text, not a surface: scaling a link mid-sentence reads as a glitch.
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
