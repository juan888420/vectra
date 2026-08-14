/** A category's color is derived from its name, never stored: no column, no
 * picker, no migration, and a chip in the scenario composer always agrees with
 * the badge on a product card without either of them passing the color around.
 *
 * Renaming a category re-rolls its color. That is acceptable precisely because
 * nothing depends on the color being stable — it is a way to tell categories
 * apart at a glance, not an identity.
 *
 * Three variants per slot: `soft` for badges/chips (a tint that carries its own
 * text), `solid` for the selected state of a chip, and `wash` — a much fainter
 * bg/border pair with no text-color change — for tinting an entire card as
 * background identity without competing with the card's own foreground text.
 *
 * The ten slots are `--cat-1`..`--cat-10` in apps/web/src/index.css, which is
 * also where the hue choices and their contrast constraints are documented.
 * Two consequences of holding the palette in tokens rather than in Tailwind's
 * named scales:
 *
 * 1. No `dark:` variants appear below. The tokens themselves are redefined
 *    under `.dark`, so one class name is correct in both themes — this file
 *    used to carry every color twice.
 * 2. The opacities below are the ones that were measured: `soft` at 15% and
 *    `wash` at 8% keep `--cat-N-ink` and `--foreground` respectively above
 *    4.5:1 once composited over the card, in both themes.
 */
const CATEGORY_COLORS = [
  {
    soft: "border-cat-1/30 bg-cat-1/15 text-cat-1-ink",
    solid: "border-cat-1 bg-cat-1 text-cat-on",
    wash: "border-cat-1/25 bg-cat-1/8",
  },
  {
    soft: "border-cat-2/30 bg-cat-2/15 text-cat-2-ink",
    solid: "border-cat-2 bg-cat-2 text-cat-on",
    wash: "border-cat-2/25 bg-cat-2/8",
  },
  {
    soft: "border-cat-3/30 bg-cat-3/15 text-cat-3-ink",
    solid: "border-cat-3 bg-cat-3 text-cat-on",
    wash: "border-cat-3/25 bg-cat-3/8",
  },
  {
    soft: "border-cat-4/30 bg-cat-4/15 text-cat-4-ink",
    solid: "border-cat-4 bg-cat-4 text-cat-on",
    wash: "border-cat-4/25 bg-cat-4/8",
  },
  {
    soft: "border-cat-5/30 bg-cat-5/15 text-cat-5-ink",
    solid: "border-cat-5 bg-cat-5 text-cat-on",
    wash: "border-cat-5/25 bg-cat-5/8",
  },
  {
    soft: "border-cat-6/30 bg-cat-6/15 text-cat-6-ink",
    solid: "border-cat-6 bg-cat-6 text-cat-on",
    wash: "border-cat-6/25 bg-cat-6/8",
  },
  {
    soft: "border-cat-7/30 bg-cat-7/15 text-cat-7-ink",
    solid: "border-cat-7 bg-cat-7 text-cat-on",
    wash: "border-cat-7/25 bg-cat-7/8",
  },
  {
    soft: "border-cat-8/30 bg-cat-8/15 text-cat-8-ink",
    solid: "border-cat-8 bg-cat-8 text-cat-on",
    wash: "border-cat-8/25 bg-cat-8/8",
  },
  {
    soft: "border-cat-9/30 bg-cat-9/15 text-cat-9-ink",
    solid: "border-cat-9 bg-cat-9 text-cat-on",
    wash: "border-cat-9/25 bg-cat-9/8",
  },
  {
    soft: "border-cat-10/30 bg-cat-10/15 text-cat-10-ink",
    solid: "border-cat-10 bg-cat-10 text-cat-on",
    wash: "border-cat-10/25 bg-cat-10/8",
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
function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** Slot for a name considered on its own, with no knowledge of the other
 * categories. Kept for the cases where the full set genuinely isn't available;
 * prefer `useCategoryColor`, which never lets two visible categories share a
 * color while a slot is still free. See `assignCategoryColors` for why hashing
 * a name in isolation cannot make that promise. */
export function categoryColor(name: string): CategoryColor {
  const index = hash(normalize(name)) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[index] as CategoryColor;
}

/** Assigns colors to a whole set of categories at once.
 *
 * Hashing each name independently — what this module did before — cannot avoid
 * repeats, and the fix is not a better hash. Dropping n names into 10 slots is
 * balls-in-bins: with 12 categories, ~2.5 slots are expected to come up empty
 * while others take two or three, whatever the hash function is. Measured on
 * the real data, plain djb2 filled 8 of 10 slots and put three categories on
 * one color; running the same names through a strong avalanche mix made it
 * *worse* (7 of 10). The only way to stop two visible categories sharing a
 * color while a slot sits unused is to assign them together.
 *
 * The result is still deterministic and independent of input order, and it
 * guarantees:
 *   - up to 10 categories, every one gets a different color;
 *   - beyond 10, loads differ by at most 1 (some sharing is forced by the
 *     pigeonhole principle, but never three on one color while another is free).
 *
 * Stability is preserved where it can be: a category alone in its hashed slot
 * always keeps it, so adding or renaming one only re-homes the few that were
 * actually contesting a slot.
 */
export function assignCategoryColors(names: readonly string[]): Map<string, CategoryColor> {
  const slotCount = CATEGORY_COLORS.length;
  const entries = [...new Set(names.map(normalize))]
    .map((key) => ({ key, hash: hash(key) }))
    // Sorted by hash so the outcome never depends on the order the API
    // happened to return, and lowest hash deterministically wins a contest.
    .sort((a, b) => a.hash - b.hash || (a.key < b.key ? -1 : 1));

  const claims = new Map<number, typeof entries>();
  for (const entry of entries) {
    const preferred = entry.hash % slotCount;
    const group = claims.get(preferred);
    if (group) group.push(entry);
    else claims.set(preferred, [entry]);
  }

  const load = new Array<number>(slotCount).fill(0);
  const assigned = new Map<string, number>();
  const displaced: typeof entries = [];

  // Pass 1 — uncontested names keep their hashed slot. This is what keeps
  // colors stable across edits: only contested slots can move.
  for (const [slot, group] of claims) {
    const [winner, ...losers] = group;
    if (winner) {
      assigned.set(winner.key, slot);
      load[slot] = (load[slot] ?? 0) + 1;
    }
    displaced.push(...losers);
  }

  // Pass 2 — everyone else takes the emptiest slot, probing forward from their
  // own preference so the choice still follows from their hash rather than
  // from their position in the list.
  for (const entry of displaced) {
    let best = entry.hash % slotCount;
    for (let step = 1; step < slotCount; step += 1) {
      const candidate = (entry.hash + step) % slotCount;
      if ((load[candidate] ?? 0) < (load[best] ?? 0)) best = candidate;
      if ((load[best] ?? 0) === 0) break;
    }
    assigned.set(entry.key, best);
    load[best] = (load[best] ?? 0) + 1;
  }

  return new Map([...assigned].map(([key, slot]) => [key, CATEGORY_COLORS[slot] as CategoryColor]));
}
