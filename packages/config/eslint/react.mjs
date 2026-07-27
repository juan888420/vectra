import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

import base from "./base.mjs";

// React/JSX rules on top of the shared TS base. Consumers (apps/web,
// packages/ui) spread this alongside `base` in their own eslint.config.mjs —
// ESLint v9 flat config uses the nearest config file, not a cascade, so each
// package with JSX must compose the full rule set itself.
export default [
  ...base,
  reactHooks.configs["recommended-latest"],
  {
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": "warn",
    },
  },
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
];
