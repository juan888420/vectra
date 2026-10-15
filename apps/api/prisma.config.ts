import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Set in apps/api/.env (see .env.example). Read leniently on purpose:
    // `generate` runs at image build time with no database, while the commands
    // that do connect (migrate deploy, db seed) fail on their own without it.
    url: process.env.DATABASE_URL,
  },
});
