import { describe, expect, it } from "vitest";
import { buildDiagnosticReport } from "./report";

const GENERATED_AT = "2026-06-19T12:00:00.000Z";
const ACCESS_PASSWORD = "correct horse battery staple";

describe("buildDiagnosticReport", () => {
  it("reports a healthy Vercel deployment without exposing secrets", () => {
    const report = buildDiagnosticReport({
      accessPassword: ACCESS_PASSWORD,
      commitSha: "abcdef1234567890",
      environment: "production",
      generatedAt: GENERATED_AT,
      isVercel: true,
      nodeVersion: "24.17.0",
      oidcTokenConfigured: false,
      region: "lhr1",
    });

    expect(report.status).toBe("healthy");
    expect(report.diagnostics).toEqual([]);
    expect(report.configuration.gatewayAuthentication).toBe("vercel-oidc");
    expect(report.deployment.commitSha).toBe("abcdef1");
    expect(JSON.stringify(report)).not.toContain(ACCESS_PASSWORD);
  });

  it("returns actionable codes for missing local configuration", () => {
    const report = buildDiagnosticReport({
      accessPassword: undefined,
      environment: "development",
      generatedAt: GENERATED_AT,
      isVercel: false,
      nodeVersion: "22.0.0",
      oidcTokenConfigured: false,
    });

    expect(report.status).toBe("needs_attention");
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "EVE_C001",
      "EVE_C003",
      "EVE_C004",
    ]);
    expect(report.diagnostics.every((diagnostic) => diagnostic.fix.length > 0)).toBe(true);
  });

  it("distinguishes an invalid access password from a missing one", () => {
    const report = buildDiagnosticReport({
      accessPassword: "too-short",
      environment: "production",
      generatedAt: GENERATED_AT,
      isVercel: true,
      nodeVersion: "24.17.0",
      oidcTokenConfigured: false,
    });

    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["EVE_C002"]);
  });
});
