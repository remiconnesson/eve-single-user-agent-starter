import { describe, expect, it } from "vitest";
import { resolveAccessMode } from "./access";

describe("resolveAccessMode", () => {
  it("opens Vercel Preview deployments", () => {
    expect(resolveAccessMode({ nodeEnv: "production", vercelEnv: "preview" })).toBe(
      "preview",
    );
  });

  it("opens local and Vercel development", () => {
    expect(resolveAccessMode({ nodeEnv: "development" })).toBe("development");
    expect(
      resolveAccessMode({ nodeEnv: "production", vercelEnv: "development" }),
    ).toBe("development");
  });

  it("keeps production and unknown environments password-protected", () => {
    expect(resolveAccessMode({ nodeEnv: "production", vercelEnv: "production" })).toBe(
      "password",
    );
    expect(
      resolveAccessMode({ nodeEnv: "development", vercelEnv: "production" }),
    ).toBe("password");
    expect(resolveAccessMode({ nodeEnv: "test" })).toBe("password");
    expect(resolveAccessMode({})).toBe("password");
  });
});
