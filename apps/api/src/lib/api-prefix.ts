// Every API route lives under this prefix so the same origin can serve the
// SPA everywhere else (ADR-0008). Cookie paths derive from it — change it
// here and nowhere else.
export const API_PREFIX = "/api";
