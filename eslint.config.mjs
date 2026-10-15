import base from "@vectra/config/eslint";

export default [
  ...base,
  // lint-staged lints every staged file with this root config, which (unlike
  // apps/web's) has no browser globals. Plain scripts the SPA ships as-is
  // need the few they actually touch.
  {
    files: ["apps/web/public/**/*.js"],
    languageOptions: {
      globals: { window: "readonly", document: "readonly", localStorage: "readonly" },
    },
  },
];
