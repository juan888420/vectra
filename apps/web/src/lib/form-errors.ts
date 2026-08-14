import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { ApiError } from "./api-client.js";
import { getErrorMessage, type ErrorResource } from "./error-messages.js";

// The create/edit dialogs (categories, products, ...) all hit the same shape
// of failure: a name that is already taken belongs under the name field, any
// other failure is a generic toast. Returns whether it handled the error, so
// callers know whether to fall back to their own toast.
//
// Scoped to DUPLICATE_NAME rather than to any 409: the other conflicts
// (RESOURCE_IN_USE, SYSTEM_CATEGORY, ...) are not about the value in this
// field, so pinning them under it would misattribute the problem.
export function applyConflictError<TFieldValues extends FieldValues>(
  error: unknown,
  form: UseFormReturn<TFieldValues>,
  field: Path<TFieldValues>,
  resource?: ErrorResource,
): boolean {
  if (error instanceof ApiError && error.code === "DUPLICATE_NAME") {
    form.setError(field, { message: getErrorMessage(error, resource) });
    return true;
  }
  return false;
}
