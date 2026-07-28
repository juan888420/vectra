import { setupServer } from "msw/node";

// Shared MSW server: individual test files register handlers with
// `server.use(...)`, reset in tests/setup.ts's afterEach so one test's
// handlers never leak into the next.
export const server = setupServer();
