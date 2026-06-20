import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, parseAccessPassword, SESSION_COOKIE_NAME } from "./session";
import {
  loginPathForAccessAuthorization,
  readAccessAuthorization,
  resolveAccessMode,
} from "./access";

const ACCESS_PASSWORD = "correct horse battery staple";

afterEach(() => {
  vi.unstubAllEnvs();
});

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

describe("readAccessAuthorization", () => {
  it("returns a misconfigured result instead of throwing when the production password is missing", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", "");

    const authorization = await readAccessAuthorization(null);

    expect(authorization).toMatchObject({
      diagnostic: { name: "EVE_C001" },
      kind: "misconfigured",
    });
    if (authorization.kind === "authorized") {
      throw new TypeError("Expected access to be misconfigured.");
    }
    expect(loginPathForAccessAuthorization(authorization)).toBe(
      "/login?error=configuration",
    );
  });

  it("authorizes a valid signed session", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);
    const token = await createSessionToken({
      password: parseAccessPassword(ACCESS_PASSWORD),
    });

    await expect(
      readAccessAuthorization(`${SESSION_COOKIE_NAME}=${token}`),
    ).resolves.toEqual({ kind: "authorized" });
  });
});
