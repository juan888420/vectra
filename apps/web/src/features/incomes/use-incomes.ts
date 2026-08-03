import type { ListIncomesQuery, UpdateIncomeBody } from "@vectra/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { scenariosKeys } from "../scenarios/scenarios.keys.js";
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

// Editing an income syncs the name into every scenario snapshot linked to
// it (RFC-0023.3), so scenario views need refreshing alongside incomes.
function invalidateIncomesAndScenarios(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: incomesKeys.all });
  queryClient.invalidateQueries({ queryKey: scenariosKeys.all });
}

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
    onSuccess: () => invalidateIncomesAndScenarios(queryClient),
  });
}

export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateIncomeBody }) =>
      updateIncomeRequest(id, body),
    onSuccess: () => invalidateIncomesAndScenarios(queryClient),
  });
}

export function useArchiveIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveIncomeRequest,
    onSuccess: () => invalidateIncomesAndScenarios(queryClient),
  });
}

export function useUnarchiveIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unarchiveIncomeRequest,
    onSuccess: () => invalidateIncomesAndScenarios(queryClient),
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteIncomeRequest,
    onSuccess: () => invalidateIncomesAndScenarios(queryClient),
  });
}
