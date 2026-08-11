import { cn } from "@vectra/ui";
import type { ReactNode } from "react";

/** `tile` is the dense catalogue grid (Productos); `card` is the airier one
 * for the two collections a user has few of (Categorías, Ingresos). */
export type CardGridDensity = "tile" | "card";

// Column minimums and gaps both step up with the viewport. The smallest step
// is exactly what these pages already shipped, so nothing below `sm` moves;
// the `lg` step is the point of this change — at 1280px the products page was
// laying out eight 104px cards across a 896px container, which read as one
// striped block rather than a set of items.
const DENSITY: Record<CardGridDensity, string> = {
  tile: cn(
    "grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2",
    "sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-3",
    "lg:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] lg:gap-4",
  ),
  card: cn(
    "grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3",
    "lg:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] lg:gap-5",
  ),
};

interface CardGridProps {
  density?: CardGridDensity;
  className?: string;
  children: ReactNode;
}

/** Always a `<ul>`, including while loading — skeleton placeholders go in as
 * `<li>`s so the loading state occupies the same grid the content will,
 * instead of each page hand-rolling a second set of grid classes that then
 * drift from the real one. */
export function CardGrid({ density = "card", className, children }: CardGridProps) {
  return <ul className={cn(DENSITY[density], className)}>{children}</ul>;
}
