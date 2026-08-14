import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@vectra/ui";
import type { ComponentType, ReactNode } from "react";

export type StatTone = "positive" | "warning" | "negative";

// Badge only ships default/secondary/outline variants (no semantic color
// scale), so tone is applied via className override here rather than
// changing the shared primitive for a single consumer.
//
// These used to be Tailwind's named scales (emerald/amber/red), which meant
// "positive" was a different green from the app's own `--success` — the very
// collision the category palette excludes those hues to avoid. They now read
// from the semantic tokens, so there is one green, one amber and one red in
// the product. The `-ink` pairing is required, not decorative: the tint
// darkens the ground, so the base colour on top of it falls under 4.5:1.
// No `dark:` variants — the tokens are redefined per theme.
const TONE_BADGE_CLASSNAME: Record<StatTone, string> = {
  positive: "border-transparent bg-success/15 text-success-ink",
  warning: "border-transparent bg-warning/15 text-warning-ink",
  negative: "border-transparent bg-destructive/15 text-destructive-ink",
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  badge?: { label: string; tone: StatTone };
  isLoading?: boolean;
  /** Exact figure behind an abbreviated `value`, surfaced on hover. */
  valueTitle?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  badge,
  isLoading,
  valueTitle,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="truncate text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          // Wraps rather than overflows: three of these sit side by side from
          // sm up, which leaves each one about 200px for a figure that can be
          // eight digits long.
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="min-w-0 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl"
              title={valueTitle}
            >
              {value}
            </span>
            {badge ? (
              <Badge className={TONE_BADGE_CLASSNAME[badge.tone]}>{badge.label}</Badge>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
