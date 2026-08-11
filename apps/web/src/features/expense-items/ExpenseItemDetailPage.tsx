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
  DropdownMenuItem,
  Skeleton,
} from "@vectra/ui";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { DetailPageHeader } from "../../components/DetailPageHeader.js";
import { PageContainer } from "../../components/PageContainer.js";
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
      <PageContainer className="flex flex-col gap-6 lg:gap-8">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </PageContainer>
    );
  }

  const { item, scenarios } = summary;
  const category = (categoriesData?.data ?? []).find((entry) => entry.id === item.categoryId);

  return (
    <PageContainer className="flex flex-col gap-6 lg:gap-8">
      <DetailPageHeader
        backTo="/expense-items"
        backLabel="Productos"
        title={item.name}
        actionsLabel="Acciones del producto"
        badges={
          <>
            <Badge variant="outline">{FREQUENCY_LABELS[item.frequency]}</Badge>
            {item.archivedAt ? <Badge variant="secondary">Archivado</Badge> : null}
          </>
        }
        actions={
          <>
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
          </>
        }
      >
        {category ? (
          <Link
            to={`/categories/${category.id}`}
            className="mt-1 inline-block rounded-md text-sm text-muted-foreground hover:text-foreground hover:underline focus-ring"
          >
            {category.name}
          </Link>
        ) : null}
      </DetailPageHeader>

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
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
