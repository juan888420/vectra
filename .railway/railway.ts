// Railway project for the single-service deploy (ADR-0008). Railway does not
// read this file on deploy: it is applied with `railway config plan` and
// `railway config apply`, and a plan must be reviewed before every apply.
import { defineRailway, github, postgres, project, service } from "railway/iac";

export default defineRailway((ctx) => {
  const db = postgres("postgres");

  const app = service("vectra", {
    // Deploys main only after its GitHub Actions run passes ("Wait for CI").
    source: github("juan888420/vectra", { branch: "main", checkSuites: true }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      // Everything except the backup job, which has its own service below.
      watchPatterns: ["**", "!/ops/db-backup/**"],
    },
    // Release step: same command the CI smoke test runs inside the image. The
    // server never migrates on boot.
    preDeploy: "npx --no-install prisma migrate deploy",
    // Railway's default is no limit: a migration stuck on a lock would hold
    // the deploy forever instead of failing it.
    deploy: {
      preDeployTimeoutSeconds: 300,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    // The rate limiter keeps its counters in process memory: a second replica
    // would double every budget. Scale out only with a shared store.
    replicas: 1,
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      // References the environment's sealed shared variable (${{shared.JWT_SECRET}}),
      // created in the Railway dashboard; the value never enters the repo.
      JWT_SECRET: ctx.shared.JWT_SECRET,
    },
  });

  // Nightly encrypted pg_dump to Cloudflare R2, off Railway
  // (docs/operations/db-backups.md). Values marked <SET_ME> are filled in by
  // the owner before the first apply; backup.sh refuses to run with them.
  const backup = service("db-backup", {
    source: github("juan888420/vectra", { branch: "main", checkSuites: true }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "ops/db-backup/Dockerfile",
      watchPatterns: ["/ops/db-backup/**"],
    },
    deploy: {
      // 06:00 UTC. Railway skips a run while the previous one is still going.
      cronSchedule: "0 6 * * *",
      // A failed run is reported by the missing heartbeat, not retried: a
      // retry could overlap the next run.
      restartPolicyType: "NEVER",
    },
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      // Sealed shared variables created in the Railway dashboard, like JWT_SECRET.
      R2_ACCESS_KEY_ID: ctx.shared.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: ctx.shared.R2_SECRET_ACCESS_KEY,
      R2_ENDPOINT: "<SET_ME: https://<account_id>.r2.cloudflarestorage.com>",
      R2_BUCKET: "<SET_ME: bucket name>",
      // Public key only: the private key never enters Railway or R2.
      AGE_RECIPIENT: "<SET_ME: age1... public key>",
      HEARTBEAT_URL: "<SET_ME: heartbeat ping URL>",
    },
  });

  return project("vectra", {
    resources: [db, app, backup],
  });
});
