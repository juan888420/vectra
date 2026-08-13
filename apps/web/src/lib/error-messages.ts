import type { ErrorCode } from "@vectra/types";

import { ApiError } from "./api-client.js";

// The single place that turns an API failure into text a user reads.
//
// The API never sends Spanish: it sends a stable `code` plus an English
// technical `message` meant for logs and Swagger. Rendering that `message`
// is what used to leak "Category has associated records" into a toast, so
// nothing outside this module should ever touch it.
//
// Copy convention for a business conflict: what happened, why, and what the
// user can do instead — in that order, in at most two sentences.

// Which resource the failing action was about. Only needed where one code
// covers several resources and the copy would otherwise be vague; callers
// that omit it get the generic wording, which is always a valid sentence.
export type ErrorResource = "category" | "expenseItem" | "income" | "scenario";

export const GENERIC_ERROR_MESSAGE = "Algo salió mal. Intenta de nuevo.";

const GENERIC: Record<ErrorCode, string> = {
  VALIDATION_FAILED: "Revisa los datos e intenta de nuevo.",
  RESOURCE_NOT_FOUND: "Este elemento ya no existe. Actualiza la página para ver los cambios.",
  DUPLICATE_NAME: "Ya existe otro elemento con ese nombre. Elige uno distinto.",
  RESOURCE_IN_USE:
    "No se puede eliminar porque está siendo usado en uno o más escenarios. Archívalo para dejar de usarlo sin afectar esos escenarios.",
  CATEGORY_HAS_ITEMS:
    "No se puede eliminar esta categoría porque tiene productos asociados. Puedes moverlos a otra categoría o archivarla.",
  CATEGORY_HAS_RECORDS:
    "No se puede eliminar esta categoría porque tiene datos asociados. Archívala para dejar de verla sin perder esa información.",
  SYSTEM_CATEGORY: "Esta categoría es del sistema y no se puede modificar ni eliminar.",
  ARCHIVED_RESOURCE: "Este elemento está archivado. Desarchívalo para poder usarlo.",
  ALREADY_INCLUDED: "Ya está incluido en este escenario.",
  CYCLE_DETECTED:
    "No puedes incluir este escenario porque crearía un ciclo: un escenario no puede contenerse a sí mismo, ni directa ni indirectamente.",
  INVALID_CATEGORY: "Esa categoría no es válida para esta acción. Elige otra.",
  UNAUTHENTICATED: "Tu sesión expiró. Inicia sesión de nuevo.",
  INVALID_CREDENTIALS: "Email o contraseña incorrectos.",
  EMAIL_TAKEN: "Este correo ya está registrado.",
  RATE_LIMITED: "Demasiados intentos. Espera un momento e intenta de nuevo.",
  INTERNAL_ERROR: GENERIC_ERROR_MESSAGE,
};

const BY_RESOURCE: Partial<Record<ErrorResource, Partial<Record<ErrorCode, string>>>> = {
  category: {
    RESOURCE_NOT_FOUND: "Esta categoría ya no existe. Actualiza la página para ver los cambios.",
    DUPLICATE_NAME: "Ya existe una categoría con ese nombre. Elige otro.",
    ARCHIVED_RESOURCE: "Esta categoría está archivada. Desarchívala para poder usarla.",
  },
  expenseItem: {
    RESOURCE_NOT_FOUND: "Este producto ya no existe. Actualiza la página para ver los cambios.",
    DUPLICATE_NAME: "Ya existe un producto con ese nombre. Elige otro.",
    RESOURCE_IN_USE:
      "No se puede eliminar este producto porque está siendo usado en uno o más escenarios. Archívalo para dejar de usarlo sin afectar esos escenarios.",
    ARCHIVED_RESOURCE: "Este producto está archivado. Desarchívalo para poder usarlo.",
    ALREADY_INCLUDED: "Este producto ya está en el escenario.",
  },
  income: {
    RESOURCE_NOT_FOUND: "Este ingreso ya no existe. Actualiza la página para ver los cambios.",
    DUPLICATE_NAME: "Ya existe un ingreso con ese nombre. Elige otro.",
    RESOURCE_IN_USE:
      "No se puede eliminar este ingreso porque está vinculado a uno o más escenarios. Archívalo para dejar de usarlo sin afectar esos escenarios.",
    ARCHIVED_RESOURCE: "Este ingreso está archivado. Desarchívalo para poder usarlo.",
    ALREADY_INCLUDED: "Este ingreso ya está vinculado al escenario.",
  },
  scenario: {
    RESOURCE_NOT_FOUND: "Este escenario ya no existe. Actualiza la página para ver los cambios.",
    DUPLICATE_NAME: "Ya existe un escenario con ese nombre. Elige otro.",
    RESOURCE_IN_USE:
      "No se puede eliminar este escenario porque forma parte de otro escenario. Archívalo para dejar de usarlo sin afectar al que lo incluye.",
    ARCHIVED_RESOURCE: "Este escenario está archivado. Desarchívalo para poder editarlo.",
    ALREADY_INCLUDED: "Este escenario ya está incluido.",
  },
};

// Resolves any thrown value — API failure, network failure, bug — to copy safe
// to show. Anything without a code we recognize becomes the generic message,
// which is what keeps internal detail out of the UI by default.
export function getErrorMessage(error: unknown, resource?: ErrorResource): string {
  if (!(error instanceof ApiError) || error.code === null) {
    return GENERIC_ERROR_MESSAGE;
  }
  return (resource && BY_RESOURCE[resource]?.[error.code]) ?? GENERIC[error.code];
}
