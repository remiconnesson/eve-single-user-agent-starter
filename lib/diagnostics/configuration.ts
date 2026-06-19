import type { Diagnostic } from "nostics";
import type { AccessMode } from "@/lib/auth/access-mode";
import { resolveAccessMode } from "@/lib/auth/access-mode";
import { diagnostics } from "./catalog";

export interface ConfigurationDiagnosticInput {
  readonly accessMode: AccessMode;
  readonly accessPassword: string | undefined;
  readonly aiGatewayApiKeyConfigured: boolean;
  readonly isVercel: boolean;
  readonly nodeVersion?: string;
  readonly oidcTokenConfigured: boolean;
}

export function collectConfigurationDiagnostics(
  input: ConfigurationDiagnosticInput,
): readonly Diagnostic[] {
  const found: Diagnostic[] = [];

  if (input.accessMode === "password" && !input.accessPassword?.trim()) {
    found.push(diagnostics.EVE_C001());
  }

  if (
    !input.isVercel &&
    !input.oidcTokenConfigured &&
    !input.aiGatewayApiKeyConfigured
  ) {
    found.push(diagnostics.EVE_C003());
  }

  if (input.nodeVersion) {
    const nodeMajor = Number(input.nodeVersion.split(".")[0]);
    if (!Number.isSafeInteger(nodeMajor) || nodeMajor < 24) {
      found.push(diagnostics.EVE_C004());
    }
  }

  return found;
}

export function readConfigurationDiagnostics(): readonly Diagnostic[] {
  return collectConfigurationDiagnostics({
    accessMode: resolveAccessMode(),
    accessPassword: process.env.EVE_ACCESS_PASSWORD,
    aiGatewayApiKeyConfigured: Boolean(process.env.AI_GATEWAY_API_KEY),
    isVercel: process.env.VERCEL === "1",
    nodeVersion: readNodeVersion(),
    oidcTokenConfigured: Boolean(process.env.VERCEL_OIDC_TOKEN),
  });
}

function readNodeVersion(): string | undefined {
  const runtimeProcess: unknown = Reflect.get(globalThis, "process");
  if (typeof runtimeProcess !== "object" || runtimeProcess === null) return undefined;
  if (!("versions" in runtimeProcess)) return undefined;

  const versions: unknown = runtimeProcess.versions;
  if (typeof versions !== "object" || versions === null) return undefined;
  if (!("node" in versions) || typeof versions.node !== "string") return undefined;
  return versions.node;
}
