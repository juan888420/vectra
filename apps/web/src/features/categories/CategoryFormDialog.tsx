import { zodResolver } from "@hookform/resolvers/zod";
import { createCategoryBodySchema, type CategoryPublic, type CategoryType } from "@vectra/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vectra/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ApiError } from "../../lib/api-client.js";
import { useCreateCategory, useUpdateCategory } from "./use-categories.js";

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
};

interface CategoryFormValues {
  name: string;
  type: CategoryType;
}

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryPublic;
}

export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const isEditing = category !== undefined;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(createCategoryBodySchema),
    defaultValues: { name: "", type: "EXPENSE" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: category?.name ?? "", type: category?.type ?? "EXPENSE" });
    }
  }, [open, category, form]);

  async function onSubmit(values: CategoryFormValues) {
    try {
      if (isEditing) {
        // `type` is immutable server-side, so only `name` is ever sent.
        await updateCategory.mutateAsync({ id: category.id, body: { name: values.name } });
      } else {
        await createCategory.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        form.setError("name", { message: error.message });
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    }
  }

  const isSubmitting = createCategory.isPending || updateCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "The type of a category can't change once it's created."
              : "Categories group your transactions for budgets and reports."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEditing}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(CATEGORY_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
