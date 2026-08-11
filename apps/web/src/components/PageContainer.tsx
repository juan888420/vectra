import { cn } from "@vectra/ui";
import type { ReactNode } from "react";

interface PageContainerProps {
  className?: string;
  children: ReactNode;
}

/** The width every top-level page shares. Widening happens only from `lg`
 * (1024px) up: below that the container is still `max-w-4xl` and therefore
 * narrower than the viewport anyway, so the mobile and tablet layouts that
 * were already validated are untouched by design.
 *
 * Exists so the six pages stop repeating `mx-auto max-w-4xl` — changing how
 * much room the app takes on a large screen should be one edit, not six. */
export function PageContainer({ className, children }: PageContainerProps) {
  return <div className={cn("mx-auto w-full max-w-4xl lg:max-w-6xl", className)}>{children}</div>;
}
