import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

// Single-service deploy (ADR-0008): the API serves the built SPA from the
// same origin. A fake dist keeps this independent of `vite build`.
describe("Web app serving", () => {
  let app: FastifyInstance;
  let distDir: string;

  beforeAll(async () => {
    distDir = mkdtempSync(path.join(tmpdir(), "vectra-dist-"));
    mkdirSync(path.join(distDir, "assets"));
    writeFileSync(path.join(distDir, "index.html"), "<!doctype html><title>Vectra</title>");
    writeFileSync(path.join(distDir, "assets", "index-abc123.js"), "console.log(1)");

    app = await buildApp({ webDistDir: distDir });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(distDir, { recursive: true, force: true });
  });

  it("serves index.html at the root, always revalidated", async () => {
    const res = await app.inject({ method: "GET", url: "/" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["cache-control"]).toBe("no-cache");
  });

  it("falls back to index.html for client-side routes", async () => {
    const res = await app.inject({ method: "GET", url: "/scenarios/some-id?tab=1" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("<title>Vectra</title>");
    expect(res.headers["cache-control"]).toBe("no-cache");
  });

  it("serves fingerprinted assets as immutable", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/index-abc123.js" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("returns a real 404 for a missing file instead of the SPA", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/missing.js" });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("RESOURCE_NOT_FOUND");
  });

  it("never answers an unknown API route with the SPA", async () => {
    for (const url of ["/api", "/api/does-not-exist", "/api/scenarios/x/y/z"]) {
      const res = await app.inject({ method: "GET", url });

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe("RESOURCE_NOT_FOUND");
    }
  });

  it("keeps the API reachable under /api", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json().checks.database).toBe("up");
  });

  it("does not serve the SPA for non-navigation methods", async () => {
    const res = await app.inject({ method: "POST", url: "/scenarios" });

    expect(res.statusCode).toBe(404);
  });
});
