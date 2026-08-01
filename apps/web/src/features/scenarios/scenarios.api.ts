import {
  addScenarioCategoryResponseSchema,
  applyScenarioChangesResponseSchema,
  scenarioCategoryWatchPublicSchema,
  scenarioChangesResponseSchema,
  scenarioCompositionPublicSchema,
  scenarioIncomePublicSchema,
  scenarioItemPublicSchema,
  scenarioListResponseSchema,
  scenarioPublicSchema,
  scenarioSummarySchema,
  type AddScenarioCategoryBody,
  type AddScenarioCategoryResponse,
  type AddScenarioCompositionBody,
  type AddScenarioIncomeBody,
  type AddScenarioItemBody,
  type ApplyScenarioChangesResponse,
  type CreateScenarioBody,
  type ListScenariosQuery,
  type PaginatedResponse,
  type ScenarioCategoryWatchPublic,
  type ScenarioChange,
  type ScenarioCompositionPublic,
  type ScenarioIncomePublic,
  type ScenarioItemPublic,
  type ScenarioListItem,
  type ScenarioPublic,
  type ScenarioSummary,
  type UpdateScenarioBody,
} from "@vectra/types";
import { z } from "zod";

import { apiRequest } from "../../lib/api-client.js";

function toQueryString(query: ListScenariosQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.status) params.set("status", query.status);
  if (query.includeArchived) params.set("includeArchived", "true");

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listScenariosRequest(
  query: ListScenariosQuery,
): Promise<PaginatedResponse<ScenarioListItem>> {
  const data = await apiRequest<unknown>(`/scenarios${toQueryString(query)}`);
  return scenarioListResponseSchema.parse(data);
}

export async function getScenarioRequest(id: string): Promise<ScenarioPublic> {
  const data = await apiRequest<unknown>(`/scenarios/${id}`);
  return scenarioPublicSchema.parse(data);
}

export async function createScenarioRequest(body: CreateScenarioBody): Promise<ScenarioPublic> {
  const data = await apiRequest<unknown>("/scenarios", { method: "POST", body });
  return scenarioPublicSchema.parse(data);
}

export async function updateScenarioRequest(
  id: string,
  body: UpdateScenarioBody,
): Promise<ScenarioPublic> {
  const data = await apiRequest<unknown>(`/scenarios/${id}`, { method: "PATCH", body });
  return scenarioPublicSchema.parse(data);
}

export async function activateScenarioRequest(id: string): Promise<ScenarioPublic> {
  const data = await apiRequest<unknown>(`/scenarios/${id}/activate`, { method: "POST" });
  return scenarioPublicSchema.parse(data);
}

export async function deactivateScenarioRequest(id: string): Promise<ScenarioPublic> {
  const data = await apiRequest<unknown>(`/scenarios/${id}/deactivate`, { method: "POST" });
  return scenarioPublicSchema.parse(data);
}

export async function archiveScenarioRequest(id: string): Promise<ScenarioPublic> {
  const data = await apiRequest<unknown>(`/scenarios/${id}/archive`, { method: "POST" });
  return scenarioPublicSchema.parse(data);
}

export async function unarchiveScenarioRequest(id: string): Promise<ScenarioPublic> {
  const data = await apiRequest<unknown>(`/scenarios/${id}/unarchive`, { method: "POST" });
  return scenarioPublicSchema.parse(data);
}

export async function deleteScenarioRequest(id: string): Promise<void> {
  await apiRequest<void>(`/scenarios/${id}`, { method: "DELETE" });
}

export async function getScenarioSummaryRequest(id: string): Promise<ScenarioSummary> {
  const data = await apiRequest<unknown>(`/scenarios/${id}/summary`);
  return scenarioSummarySchema.parse(data);
}

// --- Items -------------------------------------------------------------

export async function listScenarioItemsRequest(scenarioId: string): Promise<ScenarioItemPublic[]> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/items`);
  return z.object({ data: z.array(scenarioItemPublicSchema) }).parse(data).data;
}

export async function addScenarioItemRequest(
  scenarioId: string,
  body: AddScenarioItemBody,
): Promise<ScenarioItemPublic> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/items`, {
    method: "POST",
    body,
  });
  return scenarioItemPublicSchema.parse(data);
}

export async function removeScenarioItemRequest(scenarioId: string, itemId: string): Promise<void> {
  await apiRequest<void>(`/scenarios/${scenarioId}/items/${itemId}`, { method: "DELETE" });
}

// --- Incomes -------------------------------------------------------------

export async function listScenarioIncomesRequest(
  scenarioId: string,
): Promise<ScenarioIncomePublic[]> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/incomes`);
  return z.object({ data: z.array(scenarioIncomePublicSchema) }).parse(data).data;
}

export async function addScenarioIncomeRequest(
  scenarioId: string,
  body: AddScenarioIncomeBody,
): Promise<ScenarioIncomePublic> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/incomes`, {
    method: "POST",
    body,
  });
  return scenarioIncomePublicSchema.parse(data);
}

export async function removeScenarioIncomeRequest(
  scenarioId: string,
  scenarioIncomeId: string,
): Promise<void> {
  await apiRequest<void>(`/scenarios/${scenarioId}/incomes/${scenarioIncomeId}`, {
    method: "DELETE",
  });
}

// --- Compositions --------------------------------------------------------

export async function listScenarioCompositionsRequest(
  scenarioId: string,
): Promise<ScenarioCompositionPublic[]> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/compositions`);
  return z.object({ data: z.array(scenarioCompositionPublicSchema) }).parse(data).data;
}

// The create response is a minimal `{id, childScenarioId}` — the list
// endpoint above is what carries `childScenarioName`, so callers should
// invalidate and re-list rather than rely on this response for display.
const createdCompositionSchema = z.object({ id: z.uuid(), childScenarioId: z.uuid() });

export async function addScenarioCompositionRequest(
  scenarioId: string,
  body: AddScenarioCompositionBody,
): Promise<{ id: string; childScenarioId: string }> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/compositions`, {
    method: "POST",
    body,
  });
  return createdCompositionSchema.parse(data);
}

export async function removeScenarioCompositionRequest(
  scenarioId: string,
  compositionId: string,
): Promise<void> {
  await apiRequest<void>(`/scenarios/${scenarioId}/compositions/${compositionId}`, {
    method: "DELETE",
  });
}

// --- Change review (RFC-0023.1) -----------------------------------------

export async function listScenarioChangesRequest(scenarioId: string): Promise<ScenarioChange[]> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/changes`);
  return scenarioChangesResponseSchema.parse(data).data;
}

export async function applyScenarioChangesRequest(
  scenarioId: string,
  changeIds: string[],
): Promise<ApplyScenarioChangesResponse> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/changes/apply`, {
    method: "POST",
    body: { changeIds },
  });
  return applyScenarioChangesResponseSchema.parse(data);
}

// --- Category watches & "add whole category" (ADR-0005 §7) --------------

export async function listScenarioCategoryWatchesRequest(
  scenarioId: string,
): Promise<ScenarioCategoryWatchPublic[]> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/category-watches`);
  return z.object({ data: z.array(scenarioCategoryWatchPublicSchema) }).parse(data).data;
}

export async function addScenarioCategoryRequest(
  scenarioId: string,
  body: AddScenarioCategoryBody,
): Promise<AddScenarioCategoryResponse> {
  const data = await apiRequest<unknown>(`/scenarios/${scenarioId}/category`, {
    method: "POST",
    body,
  });
  return addScenarioCategoryResponseSchema.parse(data);
}

export async function removeScenarioCategoryWatchRequest(
  scenarioId: string,
  watchId: string,
): Promise<void> {
  await apiRequest<void>(`/scenarios/${scenarioId}/category-watches/${watchId}`, {
    method: "DELETE",
  });
}
