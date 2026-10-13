import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Keeps development same-origin like production (ADR-0008): the SPA calls
    // /api and Vite forwards it to the API's default port
    // (apps/api/src/config/env.ts), so the refresh cookie stays first-party.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
