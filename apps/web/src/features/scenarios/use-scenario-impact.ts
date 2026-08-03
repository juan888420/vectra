import type { AffectedScenario, ScenarioImpactChange, SyncScenariosResponse } from "@vectra/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { scenariosKeys } from "./scenarios.keys.js";

// Exactly the shape every product/income mutation returns, so callers can
// hand the whole response straight to `report` (RFC-0023.3).
export interface ScenarioImpactReport {
  data: { id: string };
  affectedScenarios: AffectedScenario[];
  changes: ScenarioImpactChange[];
}

interface PendingImpact {
  resourceId: string;
  scenarios: AffectedScenario[];
  changes: ScenarioImpactChange[];
}

// Drives the "¿aplicar los cambios en los escenarios?" dialog for a resource
// that has *already* been saved (RFC-0023.3). Pass the mutation's own
// response to `report`; if nothing is affected the flow simply ends there.
export function useScenarioImpact(
  syncRequest: (resourceId: string) => Promise<SyncScenariosResponse>,
) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingImpact | null>(null);

  const sync = useMutation({
    mutationFn: syncRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scenariosKeys.all }),
  });

  function report({ data, affectedScenarios, changes }: ScenarioImpactReport) {
    if (affectedScenarios.length > 0) {
      setPending({ resourceId: data.id, scenarios: affectedScenarios, changes });
    }
  }

  async function confirm() {
    if (!pending) return;
    try {
      const { syncedCount } = await sync.mutateAsync(pending.resourceId);
      toast.success(
        syncedCount === 1
          ? "Se actualizó 1 escenario."
          : `Se actualizaron ${syncedCount} escenarios.`,
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Algo salió mal.");
    } finally {
      setPending(null);
    }
  }

  return {
    report,
    dialogProps: {
      scenarios: pending?.scenarios ?? [],
      changes: pending?.changes ?? [],
      isPending: sync.isPending,
      onConfirm: () => void confirm(),
      onDismiss: () => setPending(null),
    },
  };
}
