import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { Button } from "./ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.js";
import { Form } from "./ui/form.js";

// Shared shell for every create/edit dialog (categorías, productos,
// ingresos, escenarios): Dialog + RHF's <Form> + a footer whose submit button
// reflects mutation pending state. Only the fields inside <children> differ
// per feature, so that's the only thing each dialog still owns.
export interface FormDialogProps<TFieldValues extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  form: UseFormReturn<TFieldValues>;
  onSubmit: (values: TFieldValues) => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
  children: ReactNode;
}

export function FormDialog<TFieldValues extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  form,
  onSubmit,
  isSubmitting = false,
  // Spanish defaults: every screen in the app is Spanish, so an untranslated
  // fallback here could only ever be a bug leaking through.
  submitLabel = "Guardar",
  submittingLabel = "Guardando…",
  cancelLabel = "Cancelar",
  children,
}: FormDialogProps<TFieldValues>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            {children}
            {/* An explicit Cancel, not just the corner X: the other dialogs in
                the app (MoveItemsAndDeleteCategory, every AlertDialog) all
                offer one, and on touch the X is a much smaller target. */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                {cancelLabel}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? submittingLabel : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
