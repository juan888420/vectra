import type { CategorySpending } from "@vectra/types";
import { EmptyState } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { PieChart as PieChartIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface SpendingByCategoryChartProps {
  data: CategorySpending[];
  currency: string;
}

// Default export: this module is loaded via React.lazy() from
// DashboardPage.tsx so Recharts is only fetched when the dashboard route is
// actually visited.
export default function SpendingByCategoryChart({ data, currency }: SpendingByCategoryChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={PieChartIcon}
        title="Todavía no hay gastos este mes"
        description="El gasto por categoría aparecerá aquí cuando registres un gasto."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="h-56 w-full sm:w-56 sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="categoryName"
              innerRadius={50}
              outerRadius={80}
            >
              {data.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((entry) => (
          <li key={entry.categoryId} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{entry.categoryName}</span>
            <span className="text-muted-foreground">{entry.percentage.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
