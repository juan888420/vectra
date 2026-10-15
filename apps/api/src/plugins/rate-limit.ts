import rateLimit from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";

// Per minute. A signed-in user browsing quickly fires a burst of parallel
// queries per screen (~5-15), so their budget is per account and generous;
// anonymous traffic (login page, session restore) is keyed by client IP.
const USER_MAX = 300;
const ANONYMOUS_MAX = 100;

const USER_KEY_PREFIX = "user:";

// Who is asking, in a form a client cannot forge:
// - A verified access token identifies the account: no header can change it.
// - Otherwise the client IP, which is only as trustworthy as `trustProxy`
//   (see app.ts): with the right hop count, Fastify reads the address the
//   platform's own proxy appended to X-Forwarded-For and ignores whatever the
//   client prepended; with none, the header is ignored entirely.
async function clientKey(request: FastifyRequest): Promise<string> {
  try {
    const { sub } = await request.jwtVerify<{ sub: string }>();
    return `${USER_KEY_PREFIX}${sub}`;
  } catch {
    return `ip:${request.ip}`;
  }
}

export const rateLimitPlugin = fp<{ global: boolean }>(async (app, { global }) => {
  await app.register(rateLimit, {
    global,
    timeWindow: "1 minute",
    keyGenerator: clientKey,
    max: (_request, key) => (key.startsWith(USER_KEY_PREFIX) ? USER_MAX : ANONYMOUS_MAX),
  });
});
