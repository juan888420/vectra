import {
  expenseItemListResponseSchema,
  expenseItemMutationResponseSchema,
  expenseItemPublicSchema,
  expenseItemSummarySchema,
  syncScenariosResponseSchema,
  type CreateExpenseItemBody,
  type ExpenseItemMutationResponse,
  type ExpenseItemPublic,
  type ExpenseItemSummary,
  type ListExpenseItemsQuery,
  type PaginatedResponse,
  type SyncScenariosResponse,
  type UpdateExpenseItemBody,
} from "@vectra/types";

import { apiRequest } from "../../lib/api-client.js";

function toQueryString(query: ListExpenseItemsQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.frequency) params.set("frequency", query.frequency);
  if (query.includeArchived) params.set("includeArchived", "true");

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listExpenseItemsRequest(
  query: ListExpenseItemsQuery,
): Promise<PaginatedResponse<ExpenseItemPublic>> {
  const data = await apiRequest<unknown>(`/expense-items${toQueryString(query)}`);
  return expenseItemListResponseSchema.parse(data);
}

export async function createExpenseItemRequest(
  body: CreateExpenseItemBody,
): Promise<ExpenseItemPublic> {
  const data = await apiRequest<unknown>("/expense-items", { method: "POST", body });
  return expenseItemPublicSchema.parse(data);
}

// These three save unconditionally and return the scenarios their change
// would move financially, for the caller to offer syncing (RFC-0023.3).
export async function updateExpenseItemRequest(
  id: string,
  body: UpdateExpenseItemBody,
): Promise<ExpenseItemMutationResponse> {
  const data = await apiRequest<unknown>(`/expense-items/${id}`, { method: "PATCH", body });
  return expenseItemMutationResponseSchema.parse(data);
}

export async function archiveExpenseItemRequest(id: string): Promise<ExpenseItemMutationResponse> {
  const data = await apiRequest<unknown>(`/expense-items/${id}/archive`, { method: "POST" });
  return expenseItemMutationResponseSchema.parse(data);
}

export async function unarchiveExpenseItemRequest(
  id: string,
): Promise<ExpenseItemMutationResponse> {
  const data = await apiRequest<unknown>(`/expense-items/${id}/unarchive`, { method: "POST" });
  return expenseItemMutationResponseSchema.parse(data);
}

export async function syncExpenseItemScenariosRequest(id: string): Promise<SyncScenariosResponse> {
  const data = await apiRequest<unknown>(`/expense-items/${id}/sync-scenarios`, { method: "POST" });
  return syncScenariosResponseSchema.parse(data);
}

export async function deleteExpenseItemRequest(id: string): Promise<void> {
  await apiRequest<void>(`/expense-items/${id}`, { method: "DELETE" });
}

export async function getExpenseItemSummaryRequest(id: string): Promise<ExpenseItemSummary> {
  const data = await apiRequest<unknown>(`/expense-items/${id}/summary`);
  return expenseItemSummarySchema.parse(data);
}
