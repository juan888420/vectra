import type { ListCategoriesQuery, UpdateCategoryBody } from "@vectra/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { expenseItemsKeys } from "../expense-items/expense-items.keys.js";
import {
  archiveCategoryRequest,
  createCategoryRequest,
  deleteCategoryRequest,
  deleteCategoryWithReassignmentRequest,
  getCategorySummaryRequest,
  listCategoriesRequest,
  unarchiveCategoryRequest,
  updateCategoryRequest,
} from "./categories.api.js";
import { categoriesKeys } from "./categories.keys.js";

export function useCategories(query: ListCategoriesQuery) {
  return useQuery({
    queryKey: categoriesKeys.list(query),
    queryFn: () => listCategoriesRequest(query),
  });
}

export function useCategorySummary(id: string) {
  return useQuery({
    queryKey: categoriesKeys.summary(id),
    queryFn: () => getCategorySummaryRequest(id),
    enabled: id.length > 0,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategoryRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCategoryBody }) =>
      updateCategoryRequest(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}

export function useArchiveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveCategoryRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}

export function useUnarchiveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unarchiveCategoryRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCategoryRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}

// Moves the category's expense items elsewhere first, so it invalidates
// expense items too (their categoryId changed) on top of categories.
export function useDeleteCategoryWithReassignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetCategoryId }: { id: string; targetCategoryId: string }) =>
      deleteCategoryWithReassignmentRequest(id, targetCategoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKeys.all });
      queryClient.invalidateQueries({ queryKey: expenseItemsKeys.all });
    },
  });
}
