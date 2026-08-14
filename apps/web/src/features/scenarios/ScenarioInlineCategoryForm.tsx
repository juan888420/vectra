import { zodResolver } from "@hookform/resolvers/zod";
import { createCategoryBodySchema, type CategoryPublic } from "@vectra/types";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@vectra/ui";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getErrorMessage } from "../../lib/error-messages.js";
import { applyConflictError } from "../../lib/form-errors.js";
import { useCreateCategory } from "../categories/use-categories.js";

// Reuses the shared category rules (and their copy) instead of restating
// them: this form collects the same name, minus the always-EXPENSE type.
const inlineCategorySchema = createCategoryBodySchema.omit({ type: true });

type InlineCategoryValues = z.infer<typeof inlineCategorySchema>;

interface ScenarioInlineCategoryFormProps {
  onCreated: (category: CategoryPublic) => void;
  onCancel: () => void;
}

/** Inline "crear categoría" step of both composer flows (RFC-0025 cont.): a
 * category needed mid-flow is created without leaving the card, unlike
 * ExpenseItemFormDialog's equivalent which stacks a modal because that whole
 * flow is already a modal. Always EXPENSE — the composer never deals with
 * income categories. */
export function ScenarioInlineCategoryForm({
  onCreated,
  onCancel,
}: ScenarioInlineCategoryFormProps) {
  const createCategory = useCreateCategory();

  const form = useForm<InlineCategoryValues>({
    resolver: zodResolver(inlineCategorySchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: InlineCategoryValues) {
    try {
      const created = await createCategory.mutateAsync({ ...values, type: "EXPENSE" });
      onCreated(created);
    } catch (error) {
      if (!applyConflictError(error, form, "name", "category")) {
        toast.error(getErrorMessage(error, "category"));
      }
    }
  }

  return (
    <Form {...form}>
      {/* noValidate: Zod owns validation copy — see FormDialog. */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder="Suscripciones, Salud…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createCategory.isPending}>
            {createCategory.isPending ? "Creando…" : "Crear categoría"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
