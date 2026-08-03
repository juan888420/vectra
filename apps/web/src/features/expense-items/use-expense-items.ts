import type { ListExpenseItemsQuery, UpdateExpenseItemBody } from "@vectra/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { categoriesKeys } from "../categories/categories.keys.js";
import { scenariosKeys } from "../scenarios/scenarios.keys.js";
import {
  archiveExpenseItemRequest,
  createExpenseItemRequest,
  deleteExpenseItemRequest,
  getExpenseItemSummaryRequest,
  listExpenseItemsRequest,
  unarchiveExpenseItemRequest,
  updateExpenseItemRequest,
} from "./expense-items.api.js";
import { expenseItemsKeys } from "./expense-items.keys.js";

export function useExpenseItems(query: ListExpenseItemsQuery) {
  return useQuery({
    queryKey: expenseItemsKeys.list(query),
    queryFn: () => listExpenseItemsRequest(query),
  });
}

export function useExpenseItemSummary(id: string) {
  return useQuery({
    queryKey: expenseItemsKeys.summary(id),
    queryFn: () => getExpenseItemSummaryRequest(id),
  });
}

// A product's price/category feeds its category's total (ADR-0006), and
// editing it syncs the visual fields of every scenario snapshot that uses it
// (RFC-0023.3) — hence both cross-feature invalidations.
function invalidateExpenseItemsAndCategories(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: expenseItemsKeys.all });
  queryClient.invalidateQueries({ queryKey: categoriesKeys.all });
  queryClient.invalidateQueries({ queryKey: scenariosKeys.all });
}

export function useCreateExpenseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExpenseItemRequest,
    onSuccess: () => invalidateExpenseItemsAndCategories(queryClient),
  });
}

export function useUpdateExpenseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateExpenseItemBody }) =>
      updateExpenseItemRequest(id, body),
    onSuccess: () => invalidateExpenseItemsAndCategories(queryClient),
  });
}

export function useArchiveExpenseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveExpenseItemRequest,
    onSuccess: () => invalidateExpenseItemsAndCategories(queryClient),
  });
}

export function useUnarchiveExpenseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unarchiveExpenseItemRequest,
    onSuccess: () => invalidateExpenseItemsAndCategories(queryClient),
  });
}

export function useDeleteExpenseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExpenseItemRequest,
    onSuccess: () => invalidateExpenseItemsAndCategories(queryClient),
  });
}
