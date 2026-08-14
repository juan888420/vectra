import type { ReactNode } from "react";

interface ListPageHeaderProps {
  title: string;
  description: string;
  /** Primary call to action, e.g. "Nuevo producto". */
  action?: ReactNode;
}

/** Title + one-line explanation + primary action, shared by Categorías,
 * Productos and Ingresos — the three had this block duplicated almost
 * character for character, each with the same non-wrapping `justify-between`
 * row that pushed the action button out of view on a narrow screen.
 *
 * The action sits on its own line below the text on the smallest viewports:
 * side by side, a 320px row leaves the heading about 130px, which wraps a
 * title like "Categorías" into a column of syllables. */
export function ListPageHeader({ title, description, action }: ListPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:mb-8">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
      {/* `flex-wrap`: the slot now takes more than one control on Categorías
          and Ingresos (the archived toggle moved in here), and two buttons
          side by side do not fit a 320px row. */}
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
