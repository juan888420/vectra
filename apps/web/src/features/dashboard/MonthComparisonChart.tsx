import type { MonthComparison } from "@vectra/types";
import { formatMoney } from "@vectra/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface MonthComparisonChartProps {
  data: MonthComparison;
  currency: string;
}

interface MetricRow {
  metric: string;
  current: number;
  previous: number;
  changePercent: number | null;
}

function DeltaIndicator({ changePercent }: { changePercent: number | null }) {
  if (changePercent === null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="size-3" /> n/a
      </span>
    );
  }
  const isPositive = changePercent >= 0;
  return (
    <span
      className={
        isPositive
          ? "inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
          : "inline-flex items-center gap-1 text-red-600 dark:text-red-400"
      }
    >
      {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(changePercent).toFixed(0)}%
    </span>
  );
}

// Default export: this module is loaded via React.lazy() from
// DashboardPage.tsx so Recharts is only fetched when the dashboard route is
// actually visited.
export default function MonthComparisonChart({ data, currency }: MonthComparisonChartProps) {
  const rows: MetricRow[] = [
    {
      metric: "Income",
      current: data.current.income,
      previous: data.previous.income,
      changePercent: data.changePercent.income,
    },
    {
      metric: "Expenses",
      current: data.current.expenses,
      previous: data.previous.expenses,
      changePercent: data.changePercent.expenses,
    },
    {
      metric: "Balance",
      current: data.current.balance,
      previous: data.previous.balance,
      changePercent: data.changePercent.balance,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="metric" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={0} />
            <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
            <Bar
              dataKey="previous"
              name="Previous month"
              fill="var(--muted-foreground)"
              radius={4}
            />
            <Bar dataKey="current" name="This month" fill="var(--primary)" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.metric} className="flex flex-col gap-1">
            <span className="text-muted-foreground">{row.metric}</span>
            <DeltaIndicator changePercent={row.changePercent} />
          </div>
        ))}
      </div>
    </div>
  );
}
