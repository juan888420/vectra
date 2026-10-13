import { existsSync } from "node:fs";
import path from "node:path";

import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";

import { API_PREFIX } from "../lib/api-prefix.js";
import { sendRouteNotFound } from "./error-handler.js";

// Vite fingerprints everything under assets/, so those can be cached forever;
// index.html must always be revalidated or a deploy would keep serving the
// previous bundle's entry point.
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "no-cache";

// Serves the built SPA from the same origin as the API (ADR-0008): one
// service, no CORS, and the refresh cookie stays first-party.
export const webAppPlugin = fp<{ root: string }>(async (app, { root }) => {
  const indexFile = path.join(root, "index.html");
  if (!existsSync(indexFile)) {
    // Fail at boot, not on the first visitor's request.
    throw new Error(`WEB_DIST_DIR has no index.html: ${root}`);
  }

  await app.register(fastifyStatic, {
    root,
    // One route per built file instead of a catch-all: anything else reaches
    // the not-found handler below, which owns the SPA fallback.
    wildcard: false,
    cacheControl: false,
    setHeaders: (reply, filePath) => {
      const isAsset = filePath.startsWith(path.join(root, "assets") + path.sep);
      void reply.header("Cache-Control", isAsset ? IMMUTABLE : REVALIDATE);
    },
  });

  app.setNotFoundHandler((request, reply) => {
    const { pathname } = new URL(request.url, "http://localhost");
    const isApi = pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
    // A missing file (has an extension) is a real 404, not a client route —
    // answering it with index.html would hide broken asset links.
    const isFile = path.extname(pathname) !== "";
    const isNavigation = request.method === "GET" || request.method === "HEAD";

    if (isApi || isFile || !isNavigation) {
      return sendRouteNotFound(reply);
    }

    void reply.header("Cache-Control", REVALIDATE);
    return reply.sendFile("index.html");
  });
});
