import { zodResolver } from "@hookform/resolvers/zod";
import type { CategoryPublic, ExpenseItemFrequency, ScenarioPublic } from "@vectra/types";
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
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, LayoutGrid, Plus, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { useCategories } from "../categories/use-categories.js";
import { ScenarioCategoryChips } from "./ScenarioCategoryChips.js";
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

  // Surfaces as a heading above the checklist/form it labels (not in the
  // panel title) — orients the user on which category's contents they're
  // looking at without it competing with the section's own title.
  const selectedCategoryName = categoryId
    ? categories.find((category) => category.id === categoryId)?.name
    : undefined;

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

  // Picking an existing category while "Nueva categoría" is open must cancel
  // that mode in the same event, not just change categoryId — otherwise the
  // creatingCategory branch keeps winning the ternary below and the panel
  // never leaves ScenarioInlineCategoryForm even though categoryId did change.
  function selectCategory(id: string) {
    setCreatingCategory(false);
    setCategoryId(id);
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

      <CardContent className="flex flex-col gap-6 pb-8">
        {/* Deliberately NOT wrapped in AnimatePresence. Wrapping this swap
            broke category selection outright: after setCategoryId committed,
            AnimatePresence re-rendered its cached copy of the previous
            subtree, and React committed that stale output over the fresh one
            — so the chips repainted with selectedId=null and the panel below
            never appeared. The state was correct the whole time, which is why
            clicking the same chip again did nothing (Object.is bail-out) and
            only a different chip forced a render that won. Reproduced with
            framer-motion 11.15 + React 19 in both "popLayout" and the default
            mode, with the inner AnimatePresence removed, so it is the wrapper
            itself and not its mode.

            initial/animate need no AnimatePresence — only exit does. Dropping
            the exit animations is the whole cost, and it is worth it. */}
        {mode === "idle" ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-6"
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

            {/* min-h keeps this area from reading as an afterthought when
                there are only a couple of cards — the grid still grows past
                it freely once there's enough content to fill it. */}
            <div className="min-h-40">
              {isLoading ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="Sin productos"
                  description="Agrega productos para incluirlos en este escenario."
                />
              ) : (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
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
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-6"
          >
            <ScenarioCategoryChips
              categories={categories}
              selectedId={categoryId}
              onSelect={selectCategory}
              creatingCategory={creatingCategory}
              onCreateCategory={() => setCreatingCategory(true)}
            />

            {/* One AnimatePresence, one key, three mutually-exclusive
                  branches: combining creatingCategory/categoryId/none into a
                  single computed key keeps two independent state updates from
                  each thinking they own the exit. popLayout, not wait, for the
                  same reason as the outer one — the entering panel mounts
                  immediately instead of waiting out the exit animation. */}
            <AnimatePresence mode="popLayout">
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
                  className="flex flex-col gap-3"
                >
                  {selectedCategoryName ? (
                    <Badge variant="secondary" className="w-fit">
                      {selectedCategoryName}
                    </Badge>
                  ) : null}
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
      </CardContent>
    </Card>
  );
}
