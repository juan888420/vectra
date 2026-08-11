// Shared currency formatting: used anywhere a feature displays a Money value,
// so formatting stays identical across views.

/** Full precision, exactly as the locale would write it. The default for
 * detail pages, forms, dialogs and totals — anywhere the number is the thing
 * being read rather than a label on a tile. Unchanged: other surfaces depend
 * on it rendering cents. */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

// Below this, the plain form is short enough for a tile; above it, a COP-sized
// figure like "$12.345.678,00" cannot fit any card in the app and was being
// silently clipped by `truncate` (RFC-0028).
const COMPACT_THRESHOLD = 1_000_000;

/** Money sized for a small surface: mini-cards and stat cards, where the
 * amount is the headline but the column is ~100–200px wide.
 *
 * Two adjustments over `formatMoney`, both about keeping the value readable
 * rather than hiding digits:
 *
 * - Cents are dropped when they carry nothing — a whole amount reads "$1.500",
 *   while "$12,50" keeps them. In COP, the default currency for new accounts,
 *   every amount is whole, so this alone removes three wasted characters.
 * - From a million up it switches to the locale's compact notation ("$1,2 M"),
 *   because no formatting of "$30.000.000,00" fits a tile.
 *
 * Callers that use this should expose the exact figure somewhere reachable —
 * a `title` attribute on the element, or the detail page one click away —
 * since compact notation is deliberately approximate. */
export function formatMoneyCompact(amount: number, currency: string): string {
  if (Math.abs(amount) >= COMPACT_THRESHOLD) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
