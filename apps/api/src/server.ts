import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

// Graceful shutdown: stop accepting connections, then let onClose hooks
// (Prisma disconnect) run before the process exits.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    void app
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        app.log.error(error, "error during shutdown");
        process.exit(1);
      });
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`API docs available at http://${env.HOST}:${env.PORT}/docs`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
