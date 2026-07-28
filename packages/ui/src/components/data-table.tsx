import type { ReactNode } from "react";

import { TableBody, TableCell, TableHead, TableHeader, TableRow, Table } from "./ui/table.js";

// Reusable list-view table: every feature (accounts, categories, and later
// transactions) renders a paginated list the same way, so the column
// definitions are the only thing that varies per feature. Deliberately not
// built on TanStack Table — plain markup is enough for this MVP's simple
// sortable-column, no-nested-grouping needs.
export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  data: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyState?: ReactNode;
}

export function DataTable<T>({ columns, data, rowKey, isLoading, emptyState }: DataTableProps<T>) {
  if (!isLoading && data.length === 0 && emptyState) {
    return emptyState;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.id} className={column.className}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
              Loading…
            </TableCell>
          </TableRow>
        ) : (
          data.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell key={column.id} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
