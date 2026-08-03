import type {
  AddScenarioCategoryBody,
  AddScenarioCompositionBody,
  AddScenarioIncomeBody,
  AddScenarioItemBody,
  ListScenariosQuery,
  UpdateScenarioBody,
} from "@vectra/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { expenseItemsKeys } from "../expense-items/expense-items.keys.js";
import {
  activateScenarioRequest,
  addScenarioCategoryRequest,
  addScenarioCompositionRequest,
  addScenarioIncomeRequest,
  addScenarioItemRequest,
  archiveScenarioRequest,
  createScenarioRequest,
  deactivateScenarioRequest,
  deleteScenarioRequest,
  getScenarioRequest,
  getScenarioSummaryRequest,
  listScenarioCompositionsRequest,
  listScenarioIncomesRequest,
  listScenarioItemsRequest,
  listScenariosRequest,
  removeScenarioCompositionRequest,
  removeScenarioIncomeRequest,
  removeScenarioItemRequest,
  syncScenarioRequest,
  unarchiveScenarioRequest,
  updateScenarioRequest,
} from "./scenarios.api.js";
import { scenariosKeys } from "./scenarios.keys.js";

export function useScenarios(query: ListScenariosQuery) {
  return useQuery({
    queryKey: scenariosKeys.list(query),
    queryFn: () => listScenariosRequest(query),
  });
}

export function useScenario(id: string) {
  return useQuery({
    queryKey: scenariosKeys.detail(id),
    queryFn: () => getScenarioRequest(id),
  });
}

export function useScenarioSummary(id: string) {
  return useQuery({
    queryKey: scenariosKeys.summary(id),
    queryFn: () => getScenarioSummaryRequest(id),
  });
}

export function useCreateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createScenarioRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

export function useUpdateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateScenarioBody }) =>
      updateScenarioRequest(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

export function useActivateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateScenarioRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

export function useDeactivateScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateScenarioRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

export function useArchiveScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveScenarioRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

export function useUnarchiveScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unarchiveScenarioRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

export function useDeleteScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteScenarioRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

// --- Items -------------------------------------------------------------

export function useScenarioItems(scenarioId: string) {
  return useQuery({
    queryKey: scenariosKeys.items(scenarioId),
    queryFn: () => listScenarioItemsRequest(scenarioId),
  });
}

// A product's "used in these scenarios" list (ExpenseItemDetailPage) depends
// on this, so both invalidations fire — same cross-feature reasoning as
// expense-items.ts invalidating Categories.
function invalidateScenariosAndExpenseItems(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: scenariosKeys.all });
  queryClient.invalidateQueries({ queryKey: expenseItemsKeys.all });
}

export function useAddScenarioItem(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddScenarioItemBody) => addScenarioItemRequest(scenarioId, body),
    onSuccess: () => invalidateScenariosAndExpenseItems(queryClient),
  });
}

export function useRemoveScenarioItem(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => removeScenarioItemRequest(scenarioId, itemId),
    onSuccess: () => invalidateScenariosAndExpenseItems(queryClient),
  });
}

// --- Incomes -------------------------------------------------------------

export function useScenarioIncomes(scenarioId: string) {
  return useQuery({
    queryKey: scenariosKeys.incomes(scenarioId),
    queryFn: () => listScenarioIncomesRequest(scenarioId),
  });
}

export function useAddScenarioIncome(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddScenarioIncomeBody) => addScenarioIncomeRequest(scenarioId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

export function useRemoveScenarioIncome(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenarioIncomeId: string) =>
      removeScenarioIncomeRequest(scenarioId, scenarioIncomeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

// --- Compositions --------------------------------------------------------

export function useScenarioCompositions(scenarioId: string) {
  return useQuery({
    queryKey: scenariosKeys.compositions(scenarioId),
    queryFn: () => listScenarioCompositionsRequest(scenarioId),
  });
}

export function useAddScenarioComposition(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddScenarioCompositionBody) =>
      addScenarioCompositionRequest(scenarioId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

export function useRemoveScenarioComposition(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (compositionId: string) =>
      removeScenarioCompositionRequest(scenarioId, compositionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });
}

// --- Sync & "add whole category" (RFC-0023.3 / ADR-0005 §7) -------------

export function useSyncScenario(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncScenarioRequest(scenarioId),
    onSuccess: () => invalidateScenariosAndExpenseItems(queryClient),
  });
}

export function useAddScenarioCategory(scenarioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddScenarioCategoryBody) => addScenarioCategoryRequest(scenarioId, body),
    onSuccess: () => invalidateScenariosAndExpenseItems(queryClient),
  });
}
