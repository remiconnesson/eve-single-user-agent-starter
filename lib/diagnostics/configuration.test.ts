import { describe, expect, it } from "vitest";
import { collectConfigurationDiagnostics } from "./configuration";

const ACCESS_PASSWORD = "correct horse battery staple";

describe("collectConfigurationDiagnostics", () => {
  it("returns no diagnostics for a configured Vercel deployment", () => {
    const found = collectConfigurationDiagnostics({
      accessMode: "password",
      accessPassword: ACCESS_PASSWORD,
      aiGatewayApiKeyConfigured: false,
      isVercel: true,
      nodeVersion: "24.17.0",
      oidcTokenConfigured: false,
    });

    expect(found).toEqual([]);
  });

  it("returns log-ready diagnostics for missing local configuration", () => {
    const found = collectConfigurationDiagnostics({
      accessMode: "development",
      accessPassword: undefined,
      aiGatewayApiKeyConfigured: false,
      isVercel: false,
      nodeVersion: "22.0.0",
      oidcTokenConfigured: false,
    });

    expect(found.map((diagnostic) => diagnostic.name)).toEqual([
      "EVE_C003",
      "EVE_C004",
    ]);
  });

  it("accepts API key or OIDC Gateway credentials locally", () => {
    const base = {
      accessMode: "development" as const,
      accessPassword: undefined,
      isVercel: false,
      nodeVersion: "24.17.0",
    };

    expect(
      collectConfigurationDiagnostics({
        ...base,
        aiGatewayApiKeyConfigured: true,
        oidcTokenConfigured: false,
      }),
    ).toEqual([]);
    expect(
      collectConfigurationDiagnostics({
        ...base,
        aiGatewayApiKeyConfigured: false,
        oidcTokenConfigured: true,
      }),
    ).toEqual([]);
  });

  it("reports a missing production password", () => {
    const found = collectConfigurationDiagnostics({
      accessMode: "password",
      accessPassword: undefined,
      aiGatewayApiKeyConfigured: false,
      isVercel: true,
      nodeVersion: "24.17.0",
      oidcTokenConfigured: false,
    });

    expect(found.map((diagnostic) => diagnostic.name)).toEqual(["EVE_C001"]);
  });
});
