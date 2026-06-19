import type { PublicDiagnostic } from "./catalog";
import { diagnostics, toPublicDiagnostic } from "./catalog";

export interface DiagnosticReportInput {
  readonly accessPassword: string | undefined;
  readonly aiGatewayApiKeyConfigured?: boolean;
  readonly commitSha?: string;
  readonly environment: string;
  readonly generatedAt: string;
  readonly isVercel: boolean;
  readonly nodeVersion: string;
  readonly oidcTokenConfigured: boolean;
  readonly region?: string;
}

export interface DiagnosticReport {
  readonly configuration: {
    readonly accessPasswordConfigured: boolean;
    readonly gatewayAuthentication:
      | "api-key-fallback"
      | "local-oidc"
      | "missing"
      | "vercel-oidc";
  };
  readonly deployment: {
    readonly commitSha: string | null;
    readonly environment: string;
    readonly region: string | null;
  };
  readonly diagnostics: readonly PublicDiagnostic[];
  readonly generatedAt: string;
  readonly runtime: {
    readonly nodeVersion: string;
    readonly platform: "local" | "vercel";
  };
  readonly service: "eve-single-user-agent-starter";
  readonly status: "healthy" | "needs_attention";
  readonly version: 1;
}

export function buildDiagnosticReport(input: DiagnosticReportInput): DiagnosticReport {
  const foundDiagnostics: PublicDiagnostic[] = [];
  const password = input.accessPassword?.trim();

  if (!password) {
    foundDiagnostics.push(toPublicDiagnostic(diagnostics.EVE_C001()));
  }

  const gatewayAuthentication = resolveGatewayAuthentication(input);
  if (gatewayAuthentication === "missing") {
    foundDiagnostics.push(toPublicDiagnostic(diagnostics.EVE_C003()));
  }

  const nodeMajor = Number(input.nodeVersion.split(".")[0]);
  if (!Number.isSafeInteger(nodeMajor) || nodeMajor < 24) {
    foundDiagnostics.push(toPublicDiagnostic(diagnostics.EVE_C004()));
  }

  return {
    configuration: {
      accessPasswordConfigured: Boolean(password),
      gatewayAuthentication,
    },
    deployment: {
      commitSha: input.commitSha?.slice(0, 7) ?? null,
      environment: input.environment,
      region: input.region ?? null,
    },
    diagnostics: foundDiagnostics,
    generatedAt: input.generatedAt,
    runtime: {
      nodeVersion: input.nodeVersion,
      platform: input.isVercel ? "vercel" : "local",
    },
    service: "eve-single-user-agent-starter",
    status: foundDiagnostics.length === 0 ? "healthy" : "needs_attention",
    version: 1,
  };
}

export function readDiagnosticReport(): DiagnosticReport {
  return buildDiagnosticReport({
    accessPassword: process.env.EVE_ACCESS_PASSWORD,
    aiGatewayApiKeyConfigured: Boolean(process.env.AI_GATEWAY_API_KEY),
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    generatedAt: new Date().toISOString(),
    isVercel: process.env.VERCEL === "1",
    nodeVersion: process.versions.node,
    oidcTokenConfigured: Boolean(process.env.VERCEL_OIDC_TOKEN),
    region: process.env.VERCEL_REGION,
  });
}

function resolveGatewayAuthentication(
  input: DiagnosticReportInput,
): DiagnosticReport["configuration"]["gatewayAuthentication"] {
  if (input.isVercel) return "vercel-oidc";
  if (input.oidcTokenConfigured) return "local-oidc";
  if (input.aiGatewayApiKeyConfigured) return "api-key-fallback";
  return "missing";
}
