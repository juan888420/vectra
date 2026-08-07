import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@vectra/ui";
import type { ComponentType, ReactNode } from "react";

export type StatTone = "positive" | "warning" | "negative";

// Badge only ships default/secondary/outline variants (no semantic color
// scale), so tone is applied via className override here rather than
// changing the shared primitive for a single consumer.
const TONE_BADGE_CLASSNAME: Record<StatTone, string> = {
  positive:
    "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  warning: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  negative: "border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  badge?: { label: string; tone: StatTone };
  isLoading?: boolean;
}

export function StatCard({ label, value, icon: Icon, badge, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight">{value}</span>
            {badge ? (
              <Badge className={TONE_BADGE_CLASSNAME[badge.tone]}>{badge.label}</Badge>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
