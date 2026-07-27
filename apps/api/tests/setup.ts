import { fileURLToPath } from "node:url";
import path from "node:path";

import { config } from "dotenv";

// Loaded before any test module (and before src/config/env.ts's own
// `dotenv/config` import), so DATABASE_URL/JWT_SECRET point at the test
// database, not apps/api/.env's development one.
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env.test") });
