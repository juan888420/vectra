import type { ListCategoriesQuery, UpdateCategoryBody } from "@vectra/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveCategoryRequest,
  createCategoryRequest,
  deleteCategoryRequest,
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
