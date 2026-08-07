/** A category's color is derived from its name, never stored: no column, no
 * picker, no migration, and a chip in the scenario composer always agrees with
 * the badge on a product card without either of them passing the color around.
 *
 * Renaming a category re-rolls its color. That is acceptable precisely because
 * nothing depends on the color being stable — it is a way to tell categories
 * apart at a glance, not an identity.
 *
 * Three variants per hue: `soft` for badges/chips (opaque enough to carry
 * text on its own), `solid` for the selected state of a chip, and `wash` — a
 * much lower-opacity bg/border pair with no text-color change — for tinting
 * an entire card as background identity without competing with the card's
 * own foreground text.
 */

// Amber and red are deliberately absent: amber already means "Desactualizado"
// on a scenario item card, and red means destructive everywhere else. A
// category tinted like either would read as a state instead of a name.
const CATEGORY_COLORS = [
  {
    soft: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
    solid:
      "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950",
    wash: "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20",
  },
  {
    soft: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-300",
    solid:
      "border-teal-600 bg-teal-600 text-white dark:border-teal-500 dark:bg-teal-500 dark:text-teal-950",
    wash: "border-teal-200/60 bg-teal-50/50 dark:border-teal-900/40 dark:bg-teal-950/20",
  },
  {
    soft: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-300",
    solid:
      "border-cyan-600 bg-cyan-600 text-white dark:border-cyan-500 dark:bg-cyan-500 dark:text-cyan-950",
    wash: "border-cyan-200/60 bg-cyan-50/50 dark:border-cyan-900/40 dark:bg-cyan-950/20",
  },
  {
    soft: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300",
    solid:
      "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500 dark:text-blue-950",
    wash: "border-blue-200/60 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20",
  },
  {
    soft: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300",
    solid:
      "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500 dark:text-indigo-950",
    wash: "border-indigo-200/60 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20",
  },
  {
    soft: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-300",
    solid:
      "border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500 dark:text-violet-950",
    wash: "border-violet-200/60 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-950/20",
  },
  {
    soft: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
    solid:
      "border-fuchsia-600 bg-fuchsia-600 text-white dark:border-fuchsia-500 dark:bg-fuchsia-500 dark:text-fuchsia-950",
    wash: "border-fuchsia-200/60 bg-fuchsia-50/50 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/20",
  },
  {
    soft: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950/60 dark:text-pink-300",
    solid:
      "border-pink-600 bg-pink-600 text-white dark:border-pink-500 dark:bg-pink-500 dark:text-pink-950",
    wash: "border-pink-200/60 bg-pink-50/50 dark:border-pink-900/40 dark:bg-pink-950/20",
  },
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** djb2. Cheap, well-distributed over short strings, and — unlike anything
 * built on Math.random or insertion order — gives the same answer on every
 * render and in every component. */
function hash(value: string): number {
  let result = 5381;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 33) ^ value.charCodeAt(index);
  }
  return result >>> 0;
}

/** Case- and whitespace-insensitive so fixing "comida" to "Comida" doesn't
 * move the category to a different color. */
export function categoryColor(name: string): CategoryColor {
  const index = hash(name.trim().toLowerCase()) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[index] as CategoryColor;
}
