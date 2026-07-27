import { z } from "zod";

// Mirrors apps/api/src/lib/schemas.ts's errorResponseSchema — every non-2xx
// response from the API follows this envelope.
export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
