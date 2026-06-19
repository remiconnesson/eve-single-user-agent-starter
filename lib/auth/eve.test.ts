import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, parseAccessPassword, SESSION_COOKIE_NAME } from "./session";
import { singleUserPasswordAuth } from "./eve";

const ACCESS_PASSWORD = "correct horse battery staple";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("singleUserPasswordAuth", () => {
  it("maps a valid cookie to the single owner principal", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);
    const token = await createSessionToken({
      password: parseAccessPassword(ACCESS_PASSWORD),
    });
    const authenticate = singleUserPasswordAuth();
    const result = await authenticate(
      new Request("https://eve.example/eve/v1/session", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );

    expect(result).toEqual({
      attributes: {},
      authenticator: "password",
      principalId: "owner",
      principalType: "user",
    });
  });

  it("skips requests with an invalid cookie", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);
    const authenticate = singleUserPasswordAuth();

    await expect(
      authenticate(
        new Request("https://eve.example/eve/v1/session", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=invalid` },
        }),
      ),
    ).resolves.toBeNull();
  });
});
