// Deterministic chart color from an opaque id (stable across requests and
// page reloads), so Recharts legends/pies don't reshuffle colors on refetch.
// No design system has been defined for the project yet, so this is a
// placeholder generator, not a brand palette.

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function chartColor(seed: string): string {
  const hue = hashString(seed) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}
