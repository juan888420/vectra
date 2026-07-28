import type { AccountBalance } from "@vectra/types";
import { DataTable, EmptyState } from "@vectra/ui";
import { formatMoney } from "@vectra/utils";
import { Wallet } from "lucide-react";

interface AccountBalancesTableProps {
  accounts: AccountBalance[];
  isLoading?: boolean;
}

export function AccountBalancesTable({ accounts, isLoading }: AccountBalancesTableProps) {
  return (
    <DataTable
      columns={[
        { id: "name", header: "Account", cell: (account) => account.name },
        {
          id: "income",
          header: "Income",
          className: "text-right",
          cell: (account) => formatMoney(account.income, account.currency),
        },
        {
          id: "expenses",
          header: "Expenses",
          className: "text-right",
          cell: (account) => formatMoney(account.expenses, account.currency),
        },
        {
          id: "balance",
          header: "Balance",
          className: "text-right font-medium",
          cell: (account) => formatMoney(account.balance, account.currency),
        },
      ]}
      data={accounts}
      rowKey={(account) => account.accountId}
      isLoading={isLoading}
      emptyState={
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add an account to see its balance here."
        />
      }
    />
  );
}
