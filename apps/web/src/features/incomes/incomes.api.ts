import {
  incomeListResponseSchema,
  incomePublicSchema,
  incomeSummarySchema,
  type CreateIncomeBody,
  type IncomePublic,
  type IncomeSummary,
  type ListIncomesQuery,
  type PaginatedResponse,
  type UpdateIncomeBody,
} from "@vectra/types";

import { apiRequest } from "../../lib/api-client.js";

function toQueryString(query: ListIncomesQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.frequency) params.set("frequency", query.frequency);
  if (query.includeArchived) params.set("includeArchived", "true");

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listIncomesRequest(
  query: ListIncomesQuery,
): Promise<PaginatedResponse<IncomePublic>> {
  const data = await apiRequest<unknown>(`/incomes${toQueryString(query)}`);
  return incomeListResponseSchema.parse(data);
}

export async function createIncomeRequest(body: CreateIncomeBody): Promise<IncomePublic> {
  const data = await apiRequest<unknown>("/incomes", { method: "POST", body });
  return incomePublicSchema.parse(data);
}

export async function updateIncomeRequest(
  id: string,
  body: UpdateIncomeBody,
): Promise<IncomePublic> {
  const data = await apiRequest<unknown>(`/incomes/${id}`, { method: "PATCH", body });
  return incomePublicSchema.parse(data);
}

export async function archiveIncomeRequest(id: string): Promise<IncomePublic> {
  const data = await apiRequest<unknown>(`/incomes/${id}/archive`, { method: "POST" });
  return incomePublicSchema.parse(data);
}

export async function unarchiveIncomeRequest(id: string): Promise<IncomePublic> {
  const data = await apiRequest<unknown>(`/incomes/${id}/unarchive`, { method: "POST" });
  return incomePublicSchema.parse(data);
}

export async function deleteIncomeRequest(id: string): Promise<void> {
  await apiRequest<void>(`/incomes/${id}`, { method: "DELETE" });
}

export async function getIncomeSummaryRequest(id: string): Promise<IncomeSummary> {
  const data = await apiRequest<unknown>(`/incomes/${id}/summary`);
  return incomeSummarySchema.parse(data);
}
