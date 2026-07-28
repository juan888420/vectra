import {
  categoryListResponseSchema,
  categoryPublicSchema,
  type CategoryPublic,
  type CreateCategoryBody,
  type ListCategoriesQuery,
  type PaginatedResponse,
  type UpdateCategoryBody,
} from "@vectra/types";

import { apiRequest } from "../../lib/api-client.js";

function toQueryString(query: ListCategoriesQuery): string {
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

export async function listCategoriesRequest(
  query: ListCategoriesQuery,
): Promise<PaginatedResponse<CategoryPublic>> {
  const data = await apiRequest<unknown>(`/categories${toQueryString(query)}`);
  return categoryListResponseSchema.parse(data);
}

export async function createCategoryRequest(body: CreateCategoryBody): Promise<CategoryPublic> {
  const data = await apiRequest<unknown>("/categories", { method: "POST", body });
  return categoryPublicSchema.parse(data);
}

export async function updateCategoryRequest(
  id: string,
  body: UpdateCategoryBody,
): Promise<CategoryPublic> {
  const data = await apiRequest<unknown>(`/categories/${id}`, { method: "PATCH", body });
  return categoryPublicSchema.parse(data);
}

export async function archiveCategoryRequest(id: string): Promise<CategoryPublic> {
  const data = await apiRequest<unknown>(`/categories/${id}/archive`, { method: "POST" });
  return categoryPublicSchema.parse(data);
}

export async function unarchiveCategoryRequest(id: string): Promise<CategoryPublic> {
  const data = await apiRequest<unknown>(`/categories/${id}/unarchive`, { method: "POST" });
  return categoryPublicSchema.parse(data);
}

export async function deleteCategoryRequest(id: string): Promise<void> {
  await apiRequest<void>(`/categories/${id}`, { method: "DELETE" });
}
