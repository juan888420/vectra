import { zodResolver } from "@hookform/resolvers/zod";
import { DEFAULT_CATEGORY_ICON, type CategoryIcon, type CategoryPublic } from "@vectra/types";
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

import { applyConflictError } from "../../lib/form-errors.js";
import { CategoryIconPicker } from "../categories/CategoryIconPicker.js";
import { useCreateCategory } from "../categories/use-categories.js";

const inlineCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(50),
  icon: z.custom<CategoryIcon>(),
});

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
    defaultValues: { name: "", icon: DEFAULT_CATEGORY_ICON },
  });

  async function onSubmit(values: InlineCategoryValues) {
    try {
      const created = await createCategory.mutateAsync({ ...values, type: "EXPENSE" });
      onCreated(created);
    } catch (error) {
      if (!applyConflictError(error, form, "name")) {
        toast.error("Algo salió mal. Intenta de nuevo.");
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icono</FormLabel>
              <FormControl>
                <CategoryIconPicker value={field.value} onChange={field.onChange} />
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
