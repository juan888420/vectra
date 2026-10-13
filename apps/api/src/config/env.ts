import "dotenv/config";

import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    /// Signs access tokens (HS256). 32+ chars so brute-forcing is unfeasible.
    JWT_SECRET: z.string().min(32),
    /// Absolute path to the built SPA (apps/web/dist). When set, this server
    /// also serves the frontend from the same origin (ADR-0008); in local
    /// development Vite serves it instead and proxies /api here.
    WEB_DIST_DIR: z.string().min(1).optional(),
  })
  .refine((env) => env.NODE_ENV !== "production" || env.WEB_DIST_DIR !== undefined, {
    message: "WEB_DIST_DIR is required in production (single-service deploy, ADR-0008)",
    path: ["WEB_DIST_DIR"],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a misconfigured server must not boot.
  console.error("Invalid environment variables:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
