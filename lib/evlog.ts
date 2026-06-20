import { createEvlog } from "evlog/next";

const SERVICE_NAME = "eve-single-user-agent-starter";

export const { log, useLogger, withEvlog } = createEvlog({
  enrich: (context) => {
    context.event.deployment = {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      region: process.env.VERCEL_REGION,
    };
  },
  minLevel: "info",
  redact: {
    paths: [
      "**.authorization",
      "**.cookie",
      "**.password",
      "**.token",
      "**.*_token",
      "**.*Token",
    ],
  },
  routes: {
    "/api/_evlog/**": { service: `${SERVICE_NAME}:client` },
    "/api/auth/**": { service: `${SERVICE_NAME}:auth` },
  },
  service: SERVICE_NAME,
  silent: process.env.NODE_ENV === "test",
});
