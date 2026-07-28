import { dashboardSummarySchema, type DashboardSummary } from "@vectra/types";

import { apiRequest } from "../../lib/api-client.js";

export async function getDashboardSummaryRequest(): Promise<DashboardSummary> {
  const data = await apiRequest<unknown>("/dashboard/summary");
  return dashboardSummarySchema.parse(data);
}
