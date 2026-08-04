import type { ExpenseItemFrequency, ScenarioPublic } from "@vectra/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, LayoutGrid, Plus, ShoppingBag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { useCategories } from "../categories/use-categories.js";
import { ScenarioCategoryGallery } from "./ScenarioCategoryGallery.js";
import { ScenarioInlineProductForm } from "./ScenarioInlineProductForm.js";
import { ScenarioProductChecklist } from "./ScenarioProductChecklist.js";
import { useAddScenarioItem, useRemoveScenarioItem, useScenarioItems } from "./use-scenarios.js";

const FREQUENCY_LABELS: Record<ExpenseItemFrequency, string> = {
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

/** Both composer flows share step one (pick a category); only step two
 * differs, so the user learns a single interaction pattern (RFC-0025). */
type Mode = "idle" | "browse" | "create";

interface ScenarioItemsSectionProps {
  scenario: ScenarioPublic;
}

export function ScenarioItemsSection({ scenario }: ScenarioItemsSectionProps) {
  const [mode, setMode] = useState<Mode>("idle");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [stagedIds, setStagedIds] = useState<ReadonlySet<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  const { data: scenarioItems, isLoading } = useScenarioItems(scenario.id);
  const { data: categoriesData } = useCategories({
    type: "EXPENSE",
    pageSize: 100,
    sortBy: "name",
  });
  const addItem = useAddScenarioItem(scenario.id);
  const removeItem = useRemoveScenarioItem(scenario.id);

  const items = useMemo(() => scenarioItems ?? [], [scenarioItems]);
  const categories = categoriesData?.data ?? [];
  const canEdit = scenario.status !== "ARCHIVED";

  // Maps the product a ScenarioItem points at back to the ScenarioItem row,
  // which is what the remove endpoint takes.
  const scenarioItemIdByProduct = useMemo(
    () => new Map(items.map((item) => [item.expenseItemId, item.id])),
    [items],
  );

  function openBrowse() {
    // Seeding from what the scenario already holds turns "Aceptar cambios"
    // into an edit of the whole selection: unchecking removes, checking adds.
    setStagedIds(new Set(items.map((item) => item.expenseItemId)));
    setCategoryId(null);
    setMode("browse");
  }

  function openCreate() {
    setCategoryId(null);
    setMode("create");
  }

  function backToIdle() {
    setMode("idle");
    setCategoryId(null);
    setStagedIds(new Set());
  }

  function toggleStaged(expenseItemId: string) {
    setStagedIds((prev) => {
      const next = new Set(prev);
      if (next.has(expenseItemId)) {
        next.delete(expenseItemId);
      } else {
        next.add(expenseItemId);
      }
      return next;
    });
  }

  const currentIds = new Set(items.map((item) => item.expenseItemId));
  const toAdd = [...stagedIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !stagedIds.has(id));
  const pendingCount = toAdd.length + toRemove.length;

  async function handleApply() {
    setIsApplying(true);
    try {
      await Promise.all([
        ...toAdd.map((expenseItemId) => addItem.mutateAsync({ expenseItemId })),
        ...toRemove.map((expenseItemId) => {
          const scenarioItemId = scenarioItemIdByProduct.get(expenseItemId);
          return scenarioItemId
            ? removeItem.mutateAsync(scenarioItemId)
            : Promise.resolve(undefined);
        }),
      ]);
      backToIdle();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    } finally {
      setIsApplying(false);
    }
  }

  async function handleCreated(expenseItemId: string) {
    try {
      await addItem.mutateAsync({ expenseItemId });
      backToIdle();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  async function handleRemove(scenarioItemId: string) {
    try {
      await removeItem.mutateAsync(scenarioItemId);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Productos</CardTitle>
        {mode !== "idle" ? (
          <Button variant="ghost" size="sm" onClick={backToIdle}>
            <ArrowLeft /> Volver
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {mode === "idle" ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-4"
            >
              {canEdit ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={openCreate}
                    className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Plus className="size-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">Nuevo producto</span>
                      <span className="text-xs text-muted-foreground">Créalo y agrégalo</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={openBrowse}
                    className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <LayoutGrid className="size-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">Desde categorías</span>
                      <span className="text-xs text-muted-foreground">Elige varios a la vez</span>
                    </span>
                  </button>
                </div>
              ) : null}

              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : items.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="Sin productos"
                  description="Agrega productos para incluirlos en este escenario."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{item.name}</span>
                          <Badge variant="outline" className="shrink-0">
                            {FREQUENCY_LABELS[item.frequency]}
                          </Badge>
                          {item.outdated ? (
                            <Badge className="shrink-0 border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                              Desactualizado
                            </Badge>
                          ) : null}
                        </div>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.categoryName}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-medium">
                          {formatMoney(item.amount, item.currency)}
                        </span>
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Quitar ${item.name}`}
                            onClick={() => void handleRemove(item.id)}
                          >
                            <X />
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {categories.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Todavía no tienes categorías de gasto. Crea una desde la sección Categorías.
                </p>
              ) : (
                <>
                  <ScenarioCategoryGallery
                    categories={categories}
                    selectedId={categoryId}
                    onSelect={setCategoryId}
                  />

                  <AnimatePresence mode="wait">
                    {categoryId ? (
                      <motion.div
                        key={`${mode}-${categoryId}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        {mode === "browse" ? (
                          <ScenarioProductChecklist
                            categoryId={categoryId}
                            stagedIds={stagedIds}
                            onToggle={toggleStaged}
                          />
                        ) : (
                          <ScenarioInlineProductForm
                            categoryId={categoryId}
                            onCreated={(item) => void handleCreated(item.id)}
                            onCancel={backToIdle}
                          />
                        )}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {mode === "browse" ? (
                    <div className="flex items-center justify-between gap-2 border-t pt-3">
                      <span className="text-sm text-muted-foreground">
                        {pendingCount === 0
                          ? "Sin cambios pendientes"
                          : `${pendingCount} ${pendingCount === 1 ? "cambio" : "cambios"} por aplicar`}
                      </span>
                      <Button
                        onClick={() => void handleApply()}
                        disabled={pendingCount === 0 || isApplying}
                      >
                        {isApplying ? "Aplicando…" : "Aceptar cambios"}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
