import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { es } from "zod/locales";

import { App } from "./app/App.js";
import "./index.css";

// Localizes Zod's built-in validation messages (invalid email, required
// field, min/max length, ...) app-wide — every zodResolver form picks this
// up automatically, so individual schemas never need per-message overrides.
z.config(es());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
