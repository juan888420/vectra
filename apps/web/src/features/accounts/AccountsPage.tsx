import type { AccountPublic, AccountType } from "@vectra/types";
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
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
} from "@vectra/ui";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { AccountFormDialog } from "./AccountFormDialog.js";
import {
  useAccounts,
  useArchiveAccount,
  useDeleteAccount,
  useUnarchiveAccount,
} from "./use-accounts.js";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Efectivo",
  BANK: "Banco",
  CREDIT_CARD: "Tarjeta de crédito",
  OTHER: "Otro",
};

const PAGE_SIZE = 20;

type FormDialogState = { mode: "create" } | { mode: "edit"; account: AccountPublic } | null;

export function AccountsPage() {
  const [page, setPage] = useState(1);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formDialog, setFormDialog] = useState<FormDialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountPublic | null>(null);

  const { data, isLoading } = useAccounts({ page, pageSize: PAGE_SIZE, includeArchived });
  const archiveAccount = useArchiveAccount();
  const unarchiveAccount = useUnarchiveAccount();
  const deleteAccount = useDeleteAccount();

  async function handleToggleArchive(account: AccountPublic) {
    try {
      if (account.archivedAt) {
        await unarchiveAccount.mutateAsync(account.id);
      } else {
        await archiveAccount.mutateAsync(account.id);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteAccount.mutateAsync(pendingDelete.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    }
  }

  const accounts = data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cuentas</h1>
          <p className="text-sm text-muted-foreground">Dónde vive tu dinero.</p>
        </div>
        <Button onClick={() => setFormDialog({ mode: "create" })}>
          <Plus /> Nueva cuenta
        </Button>
      </div>

      <div className="mb-4 flex justify-end">
        <Button
          variant={includeArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => {
            setIncludeArchived((value) => !value);
            setPage(1);
          }}
        >
          {includeArchived ? "Ocultar archivadas" : "Mostrar archivadas"}
        </Button>
      </div>

      <DataTable
        columns={[
          { id: "name", header: "Nombre", cell: (account) => account.name },
          { id: "type", header: "Tipo", cell: (account) => ACCOUNT_TYPE_LABELS[account.type] },
          { id: "currency", header: "Moneda", cell: (account) => account.currency },
          {
            id: "status",
            header: "Estado",
            cell: (account) =>
              account.archivedAt ? <Badge variant="secondary">Archivada</Badge> : null,
          },
          {
            id: "actions",
            header: "",
            className: "text-right",
            cell: (account) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Acciones para ${account.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setFormDialog({ mode: "edit", account })}>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleToggleArchive(account)}>
                    {account.archivedAt ? <ArchiveRestore /> : <Archive />}
                    {account.archivedAt ? "Desarchivar" : "Archivar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setPendingDelete(account)}
                  >
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
        data={accounts}
        rowKey={(account) => account.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Wallet}
            title="Todavía no hay cuentas"
            description="Crea tu primera cuenta para empezar a registrar transacciones."
            action={
              <Button onClick={() => setFormDialog({ mode: "create" })}>
                <Plus /> Nueva cuenta
              </Button>
            }
          />
        }
      />

      {data && data.meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {data.meta.page} de {data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <AccountFormDialog
        open={formDialog !== null}
        onOpenChange={(open) => {
          if (!open) setFormDialog(null);
        }}
        account={formDialog?.mode === "edit" ? formDialog.account : undefined}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{pendingDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las cuentas con transacciones no se pueden eliminar,
              archívalas en su lugar.
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
