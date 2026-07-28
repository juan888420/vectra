import { useQuery } from "@tanstack/react-query";

import { getDashboardSummaryRequest } from "./dashboard.api.js";
import { dashboardKeys } from "./dashboard.keys.js";

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: getDashboardSummaryRequest,
  });
}
