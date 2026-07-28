import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { ApiError } from "./api-client.js";

// The create/edit dialogs (accounts, categories, ...) all hit the same shape
// of failure: a 409 from a uniqueness check maps to a field-level error, any
// other failure is a generic toast. Returns whether it handled the error, so
// callers know whether to fall back to their own toast.
export function applyConflictError<TFieldValues extends FieldValues>(
  error: unknown,
  form: UseFormReturn<TFieldValues>,
  field: Path<TFieldValues>,
): boolean {
  if (error instanceof ApiError && error.statusCode === 409) {
    form.setError(field, { message: error.message });
    return true;
  }
  return false;
}
