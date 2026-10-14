// Railway project for the single-service deploy (ADR-0008). Railway does not
// read this file on deploy: it is applied with `railway config plan` and
// `railway config apply`, and a plan must be reviewed before every apply.
import { defineRailway, github, postgres, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const db = postgres("postgres");

  const app = service("vectra", {
    // Deploys main only after its GitHub Actions run passes ("Wait for CI").
    source: github("juan888420/vectra", { branch: "main", checkSuites: true }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
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
      // Created as a sealed variable in Railway; never written to the repo.
      JWT_SECRET: preserve(),
    },
  });

  return project("vectra", {
    resources: [db, app],
  });
});
