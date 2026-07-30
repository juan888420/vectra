import { zodResolver } from "@hookform/resolvers/zod";
import { createScenarioBodySchema, type ScenarioPublic } from "@vectra/types";
import {
  FormControl,
  FormDialog,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@vectra/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { applyConflictError } from "../../lib/form-errors.js";
import { useCreateScenario, useUpdateScenario } from "./use-scenarios.js";

interface ScenarioFormValues {
  name: string;
}

interface ScenarioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario?: ScenarioPublic;
}

export function ScenarioFormDialog({ open, onOpenChange, scenario }: ScenarioFormDialogProps) {
  const isEditing = scenario !== undefined;
  const createScenario = useCreateScenario();
  const updateScenario = useUpdateScenario();

  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(createScenarioBodySchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: scenario?.name ?? "" });
    }
  }, [open, scenario, form]);

  async function onSubmit(values: ScenarioFormValues) {
    try {
      if (isEditing) {
        await updateScenario.mutateAsync({ id: scenario.id, body: values });
      } else {
        await createScenario.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (error) {
      if (!applyConflictError(error, form, "name")) {
        toast.error(
          error instanceof ApiError ? error.message : "Algo salió mal. Intenta de nuevo.",
        );
      }
    }
  }

  const isSubmitting = createScenario.isPending || updateScenario.isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Renombrar escenario" : "Nuevo escenario"}
      description="Un escenario simula un estilo de vida o una decisión combinando productos e ingresos."
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Guardar"
      submittingLabel="Guardando…"
    >
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre</FormLabel>
            <FormControl>
              <Input autoComplete="off" placeholder="Escenario actual" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormDialog>
  );
}
