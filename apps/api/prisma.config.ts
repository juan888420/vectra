import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Set in apps/api/.env (see .env.example). Only needed for commands that
    // touch a real database (migrate, db pull); validate/generate work without it.
    url: env("DATABASE_URL"),
  },
});
