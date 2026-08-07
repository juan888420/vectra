import type { ExpenseItemFrequency } from "@vectra/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@vectra/ui";
import { Archive, ArchiveRestore, ChevronLeft, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { ProjectionStatCards } from "../../components/ProjectionStatCards.js";
import { ScenarioUsageList } from "../../components/ScenarioUsageList.js";
import { ApiError } from "../../lib/api-client.js";
import { useCategories } from "../categories/use-categories.js";
import { ScenarioImpactDialog } from "../scenarios/ScenarioImpactDialog.js";
import { useScenarioImpact } from "../scenarios/use-scenario-impact.js";
import { syncExpenseItemScenariosRequest } from "./expense-items.api.js";
import { ExpenseItemFormDialog } from "./ExpenseItemFormDialog.js";
import {
  useArchiveExpenseItem,
  useDeleteExpenseItem,
  useExpenseItemSummary,
  useUnarchiveExpenseItem,
} from "./use-expense-items.js";

const FREQUENCY_LABELS: Record<ExpenseItemFrequency, string> = {
  MONTHLY: "Mensual",
  YEARLY: "Anual",
  ONE_TIME: "Esporádico",
};

export function ExpenseItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: summary, isLoading, error } = useExpenseItemSummary(id ?? "");
  const { data: categoriesData } = useCategories({ includeArchived: true, pageSize: 100 });
  const archiveExpenseItem = useArchiveExpenseItem();
  const unarchiveExpenseItem = useUnarchiveExpenseItem();
  const deleteExpenseItem = useDeleteExpenseItem();
  const scenarioImpact = useScenarioImpact(syncExpenseItemScenariosRequest);

  if (!id || error) {
    return <Navigate to="/expense-items" replace />;
  }

  async function handleToggleArchive() {
    if (!summary) return;
    try {
      scenarioImpact.report(
        summary.item.archivedAt
          ? await unarchiveExpenseItem.mutateAsync(summary.item.id)
          : await archiveExpenseItem.mutateAsync(summary.item.id),
      );
    } catch (thrown) {
      toast.error(thrown instanceof ApiError ? thrown.message : "Algo salió mal.");
    }
  }

  async function handleDelete() {
    if (!summary) return;
    try {
      await deleteExpenseItem.mutateAsync(summary.item.id);
      navigate("/expense-items");
    } catch (thrown) {
      toast.error(thrown instanceof ApiError ? thrown.message : "Algo salió mal.");
      setConfirmingDelete(false);
    }
  }

  if (isLoading || !summary) {
    return (
      <div className="mx-auto max-w-4xl">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const { item, scenarios } = summary;
  const category = (categoriesData?.data ?? []).find((entry) => entry.id === item.categoryId);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link
          to="/expense-items"
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Productos
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{item.name}</h1>
            <Badge variant="outline">{FREQUENCY_LABELS[item.frequency]}</Badge>
            {item.archivedAt ? <Badge variant="secondary">Archivado</Badge> : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Acciones del producto">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleToggleArchive()}>
                {item.archivedAt ? <ArchiveRestore /> : <Archive />}
                {item.archivedAt ? "Desarchivar" : "Archivar"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmingDelete(true)}
              >
                <Trash2 /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {category ? (
          <Link
            to={`/categories/${category.id}`}
            className="mt-1 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {category.name}
          </Link>
        ) : null}
      </div>

      <ProjectionStatCards
        monthly={summary.totals.monthly}
        sixMonths={summary.totals.sixMonths}
        twelveMonths={summary.totals.twelveMonths}
        currency={item.currency}
        isLoading={false}
      />

      <ScenarioUsageList scenarios={scenarios} />

      <ExpenseItemFormDialog
        open={editing}
        onOpenChange={setEditing}
        expenseItem={item}
        onEdited={scenarioImpact.report}
      />

      <ScenarioImpactDialog {...scenarioImpact.dialogProps} />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{item.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los productos incluidos en algún escenario no se
              pueden eliminar, archívalos en su lugar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
