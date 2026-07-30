import type { ListIncomesQuery, UpdateIncomeBody } from "@vectra/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveIncomeRequest,
  createIncomeRequest,
  deleteIncomeRequest,
  getIncomeSummaryRequest,
  listIncomesRequest,
  unarchiveIncomeRequest,
  updateIncomeRequest,
} from "./incomes.api.js";
import { incomesKeys } from "./incomes.keys.js";

export function useIncomes(query: ListIncomesQuery) {
  return useQuery({
    queryKey: incomesKeys.list(query),
    queryFn: () => listIncomesRequest(query),
  });
}

export function useIncomeSummary(id: string) {
  return useQuery({
    queryKey: incomesKeys.summary(id),
    queryFn: () => getIncomeSummaryRequest(id),
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createIncomeRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incomesKeys.all }),
  });
}

export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateIncomeBody }) =>
      updateIncomeRequest(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incomesKeys.all }),
  });
}

export function useArchiveIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveIncomeRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incomesKeys.all }),
  });
}

export function useUnarchiveIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unarchiveIncomeRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incomesKeys.all }),
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteIncomeRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incomesKeys.all }),
  });
}
