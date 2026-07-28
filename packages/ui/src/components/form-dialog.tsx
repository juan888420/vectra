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

// Shared shell for every create/edit dialog (accounts, categories,
// transactions, ...): Dialog + RHF's <Form> + a submit button that reflects
// mutation pending state. Only the fields inside <children> differ per
// feature, so that's the only thing each dialog still owns.
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
  submitLabel = "Save",
  submittingLabel = "Saving…",
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
            <DialogFooter>
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
