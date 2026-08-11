import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@vectra/ui";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface DetailPageHeaderProps {
  backTo: string;
  backLabel: string;
  title: string;
  /** Status badges rendered next to the title; they wrap under it when the
   * name is long rather than squeezing it. */
  badges?: ReactNode;
  /** `DropdownMenuItem`s for the actions menu. Omit to hide the menu, as
   * system categories do. */
  actions?: ReactNode;
  actionsLabel?: string;
  /** Optional secondary line under the title, e.g. a product's category. */
  children?: ReactNode;
}

/** Back link + title + badges + actions menu, shared by the Categoría,
 * Producto and Ingreso detail pages (Escenario keeps its own: it lives inside
 * the master/detail layout and has no back link).
 *
 * `min-w-0` on the text column and `shrink-0` on the menu are the point: the
 * three pages previously used a plain `justify-between` row, so a long name
 * pushed the actions trigger past the edge of the container instead of
 * wrapping. */
export function DetailPageHeader({
  backTo,
  backLabel,
  title,
  badges,
  actions,
  actionsLabel = "Acciones",
  children,
}: DetailPageHeaderProps) {
  return (
    <div>
      <Link
        to={backTo}
        className="mb-2 inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-ring"
      >
        <ChevronLeft className="size-4" /> {backLabel}
      </Link>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight break-words">{title}</h1>
          {badges}
        </div>
        {actions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" aria-label={actionsLabel}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{actions}</DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {children}
    </div>
  );
}
