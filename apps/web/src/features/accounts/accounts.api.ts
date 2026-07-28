import {
  accountListResponseSchema,
  accountPublicSchema,
  type AccountPublic,
  type CreateAccountBody,
  type ListAccountsQuery,
  type PaginatedResponse,
  type UpdateAccountBody,
} from "@vectra/types";

import { apiRequest } from "../../lib/api-client.js";

// Every response is re-validated with the shared Zod schema at the network
// boundary, same discipline as features/auth/auth.api.ts.

function toQueryString(query: ListAccountsQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.type) params.set("type", query.type);
  if (query.includeArchived) params.set("includeArchived", "true");

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listAccountsRequest(
  query: ListAccountsQuery,
): Promise<PaginatedResponse<AccountPublic>> {
  const data = await apiRequest<unknown>(`/accounts${toQueryString(query)}`);
  return accountListResponseSchema.parse(data);
}

export async function createAccountRequest(body: CreateAccountBody): Promise<AccountPublic> {
  const data = await apiRequest<unknown>("/accounts", { method: "POST", body });
  return accountPublicSchema.parse(data);
}

export async function updateAccountRequest(
  id: string,
  body: UpdateAccountBody,
): Promise<AccountPublic> {
  const data = await apiRequest<unknown>(`/accounts/${id}`, { method: "PATCH", body });
  return accountPublicSchema.parse(data);
}

export async function archiveAccountRequest(id: string): Promise<AccountPublic> {
  const data = await apiRequest<unknown>(`/accounts/${id}/archive`, { method: "POST" });
  return accountPublicSchema.parse(data);
}

export async function unarchiveAccountRequest(id: string): Promise<AccountPublic> {
  const data = await apiRequest<unknown>(`/accounts/${id}/unarchive`, { method: "POST" });
  return accountPublicSchema.parse(data);
}

export async function deleteAccountRequest(id: string): Promise<void> {
  await apiRequest<void>(`/accounts/${id}`, { method: "DELETE" });
}
