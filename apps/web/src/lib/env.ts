import { z } from "zod";

// Vite only exposes VITE_-prefixed vars on import.meta.env, and already loads
// .env files natively (no dotenv/config needed, unlike apps/api). Fails loud
// on a broken env instead of silently falling back — mirrors
// apps/api/src/config/env.ts's validate-at-startup spirit, adapted for the
// browser (no process.exit available here).
const envSchema = z.object({
  VITE_API_URL: z.url(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error("Invalid environment variables:\n" + z.prettifyError(parsed.error));
  throw new Error("Invalid environment variables — see console for details");
}

export const env = parsed.data;
