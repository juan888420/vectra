import type { ExpenseItemFrequency } from "@vectra/types";
import { cn, Skeleton } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

import { useExpenseItems } from "../expense-items/use-expense-items.js";

const FREQUENCY_CHOICES: readonly (ExpenseItemFrequency | "ORIGINAL")[] = [
  "ORIGINAL",
  "MONTHLY",
  "YEARLY",
  "ONE_TIME",
];

const FREQUENCY_CHOICE_LABELS: Record<ExpenseItemFrequency | "ORIGINAL", string> = {
  ORIGINAL: "Original",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

interface ScenarioProductChecklistProps {
  categoryId: string;
  stagedIds: ReadonlySet<string>;
  /** Products the scenario already holds — these skip the frequency picker
   * below, since unchecking/rechecking them isn't "adding" (editing an
   * already-included item's frequency is the product's own edit flow, not
   * this one). */
  alreadyIncludedIds: ReadonlySet<string>;
  frequencyOverrides: ReadonlyMap<string, ExpenseItemFrequency>;
  onToggle: (expenseItemId: string) => void;
  onFrequencyChange: (expenseItemId: string, frequency: ExpenseItemFrequency | null) => void;
}

/** Step two of the "desde categorías" flow. Toggling only edits the staged
 * set held by the parent; nothing is written until the user confirms. A
 * newly-staged product also gets an inline frequency picker so this one
 * scenario can simulate it billed differently than the product itself. */
export function ScenarioProductChecklist({
  categoryId,
  stagedIds,
  alreadyIncludedIds,
  frequencyOverrides,
  onToggle,
  onFrequencyChange,
}: ScenarioProductChecklistProps) {
  const { data, isLoading } = useExpenseItems(
    { categoryId, pageSize: 100, sortBy: "name" },
    { enabled: categoryId.length > 0 },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  const items = data?.data ?? [];

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Esta categoría todavía no tiene productos.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, index) => {
        const isStaged = stagedIds.has(item.id);
        const isNew = isStaged && !alreadyIncludedIds.has(item.id);
        const currentChoice = frequencyOverrides.get(item.id) ?? "ORIGINAL";

        return (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.025 }}
          >
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              aria-pressed={isStaged}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                isStaged ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isStaged
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
              >
                <AnimatePresence>
                  {isStaged ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatMoney(item.amount, item.currency)}
              </span>
            </button>

            <AnimatePresence>
              {isNew ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="ml-8 mt-1.5 flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Frecuencia:</span>
                    <div className="flex gap-1 rounded-md bg-muted/60 p-0.5">
                      {FREQUENCY_CHOICES.map((choice) => {
                        const isSelected = choice === currentChoice;
                        return (
                          <button
                            key={choice}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onFrequencyChange(item.id, choice === "ORIGINAL" ? null : choice);
                            }}
                            aria-pressed={isSelected}
                            className={cn(
                              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                              isSelected
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {FREQUENCY_CHOICE_LABELS[choice]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.li>
        );
      })}
    </ul>
  );
}
