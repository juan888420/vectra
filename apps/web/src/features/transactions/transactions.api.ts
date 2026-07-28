import {
  transactionListResponseSchema,
  transactionPublicSchema,
  type CreateTransactionBody,
  type ListTransactionsQuery,
  type PaginatedResponse,
  type TransactionPublic,
  type UpdateTransactionBody,
} from "@vectra/types";

import { apiRequest } from "../../lib/api-client.js";

function toQueryString(query: ListTransactionsQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.accountId) params.set("accountId", query.accountId);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.type) params.set("type", query.type);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.search) params.set("search", query.search);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listTransactionsRequest(
  query: ListTransactionsQuery,
): Promise<PaginatedResponse<TransactionPublic>> {
  const data = await apiRequest<unknown>(`/transactions${toQueryString(query)}`);
  return transactionListResponseSchema.parse(data);
}

export async function createTransactionRequest(
  body: CreateTransactionBody,
): Promise<TransactionPublic> {
  const data = await apiRequest<unknown>("/transactions", { method: "POST", body });
  return transactionPublicSchema.parse(data);
}

export async function updateTransactionRequest(
  id: string,
  body: UpdateTransactionBody,
): Promise<TransactionPublic> {
  const data = await apiRequest<unknown>(`/transactions/${id}`, { method: "PATCH", body });
  return transactionPublicSchema.parse(data);
}

export async function deleteTransactionRequest(id: string): Promise<void> {
  await apiRequest<void>(`/transactions/${id}`, { method: "DELETE" });
}
