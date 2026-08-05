import { zodResolver } from "@hookform/resolvers/zod";
import type { CategoryPublic, ExpenseItemFrequency, ScenarioPublic } from "@vectra/types";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@vectra/ui";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, LayoutGrid, Plus, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { useCategories } from "../categories/use-categories.js";
import { ScenarioCategoryGallery } from "./ScenarioCategoryGallery.js";
import { ScenarioInlineCategoryForm } from "./ScenarioInlineCategoryForm.js";
import {
  INLINE_PRODUCT_DEFAULT_VALUES,
  inlineProductSchema,
  ScenarioInlineProductForm,
  type InlineProductValues,
} from "./ScenarioInlineProductForm.js";
import { ScenarioItemCard } from "./ScenarioItemCard.js";
import { ScenarioProductChecklist } from "./ScenarioProductChecklist.js";
import { useAddScenarioItem, useRemoveScenarioItem, useScenarioItems } from "./use-scenarios.js";

/** Both composer flows share step one (pick a category); only step two
 * differs, so the user learns a single interaction pattern (RFC-0025). */
type Mode = "idle" | "browse" | "create";

interface ScenarioItemsSectionProps {
  scenario: ScenarioPublic;
}

export function ScenarioItemsSection({ scenario }: ScenarioItemsSectionProps) {
  const [mode, setMode] = useState<Mode>("idle");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [stagedIds, setStagedIds] = useState<ReadonlySet<string>>(new Set());
  const [frequencyOverrides, setFrequencyOverrides] = useState<
    ReadonlyMap<string, ExpenseItemFrequency>
  >(new Map());
  const [isApplying, setIsApplying] = useState(false);

  // Owned here, not by ScenarioInlineProductForm: this component stays
  // mounted for the whole "create" session, so a "crear categoría" detour
  // (which swaps the form out of view) never resets what the user already
  // typed — only entering/leaving create mode does, explicitly, below.
  const productForm = useForm<InlineProductValues>({
    resolver: zodResolver(inlineProductSchema),
    defaultValues: INLINE_PRODUCT_DEFAULT_VALUES,
  });

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
  const currentIds = new Set(items.map((item) => item.expenseItemId));

  function openBrowse() {
    // Seeding from what the scenario already holds turns "Aceptar cambios"
    // into an edit of the whole selection: unchecking removes, checking adds.
    setStagedIds(new Set(items.map((item) => item.expenseItemId)));
    setFrequencyOverrides(new Map());
    setCategoryId(null);
    setCreatingCategory(false);
    setMode("browse");
  }

  function openCreate() {
    setCategoryId(null);
    setCreatingCategory(false);
    productForm.reset(INLINE_PRODUCT_DEFAULT_VALUES);
    setMode("create");
  }

  function backToIdle() {
    setMode("idle");
    setCategoryId(null);
    setCreatingCategory(false);
    setStagedIds(new Set());
    setFrequencyOverrides(new Map());
    productForm.reset(INLINE_PRODUCT_DEFAULT_VALUES);
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
    // Always resets to "mantener original" — a fresh check/uncheck shouldn't
    // carry a frequency choice made in a previous pass.
    setFrequencyOverrides((prev) => {
      if (!prev.has(expenseItemId)) return prev;
      const next = new Map(prev);
      next.delete(expenseItemId);
      return next;
    });
  }

  function handleFrequencyChange(expenseItemId: string, frequency: ExpenseItemFrequency | null) {
    setFrequencyOverrides((prev) => {
      const next = new Map(prev);
      if (frequency === null) {
        next.delete(expenseItemId);
      } else {
        next.set(expenseItemId, frequency);
      }
      return next;
    });
  }

  function backFromCreateCategory() {
    setCreatingCategory(false);
  }

  const toAdd = [...stagedIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !stagedIds.has(id));
  const pendingCount = toAdd.length + toRemove.length;

  async function handleApply() {
    setIsApplying(true);
    try {
      await Promise.all([
        ...toAdd.map((expenseItemId) =>
          addItem.mutateAsync({ expenseItemId, frequency: frequencyOverrides.get(expenseItemId) }),
        ),
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

  // Selecting a category and clearing "creating" happen in the same handler,
  // so React batches them into one render: the key below-gallery goes
  // straight from "new-category" to `${mode}-${newId}`, never through an
  // in-between render where neither is true.
  function handleCategoryCreated(category: CategoryPublic) {
    setCategoryId(category.id);
    setCreatingCategory(false);
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                  <Skeleton className="h-36 w-full rounded-xl" />
                  <Skeleton className="h-36 w-full rounded-xl" />
                  <Skeleton className="h-36 w-full rounded-xl" />
                  <Skeleton className="h-36 w-full rounded-xl" />
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="Sin productos"
                  description="Agrega productos para incluirlos en este escenario."
                />
              ) : (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                  {items.map((item, index) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.025 }}
                      className="flex"
                    >
                      <ScenarioItemCard
                        item={item}
                        canEdit={canEdit}
                        onRemove={() => void handleRemove(item.id)}
                      />
                    </motion.li>
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
              <ScenarioCategoryGallery
                categories={categories}
                selectedId={categoryId}
                onSelect={setCategoryId}
                creatingCategory={creatingCategory}
                onCreateCategory={() => setCreatingCategory(true)}
              />

              {/* One AnimatePresence, one key, three mutually-exclusive
                  branches. Previously this nested a second `mode="wait"`
                  AnimatePresence inside the outer idle/browse/create one,
                  switched by `categoryId` alone — introducing "creating a
                  category" as a second, independently-toggled condition on
                  the same slot meant two state updates could each think they
                  were exiting, so framer-motion sometimes needed a repeated
                  click to settle. Combining creatingCategory/categoryId/none
                  into a single computed key removes that race entirely. */}
              <AnimatePresence mode="wait">
                {creatingCategory ? (
                  <motion.div
                    key="new-category"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <ScenarioInlineCategoryForm
                      onCreated={handleCategoryCreated}
                      onCancel={backFromCreateCategory}
                    />
                  </motion.div>
                ) : categoryId ? (
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
                        alreadyIncludedIds={currentIds}
                        frequencyOverrides={frequencyOverrides}
                        onToggle={toggleStaged}
                        onFrequencyChange={handleFrequencyChange}
                      />
                    ) : (
                      <ScenarioInlineProductForm
                        form={productForm}
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
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
