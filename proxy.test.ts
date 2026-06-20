import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, parseAccessPassword, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { proxy } from "./proxy";

const ACCESS_PASSWORD = "correct horse battery staple";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy", () => {
  it("allows Vercel Preview without a password or cookie", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", "");
    vi.stubEnv("VERCEL_ENV", "preview");

    const response = await proxy(new NextRequest("https://eve.example/"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects unauthenticated page requests to login", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);

    const response = await proxy(new NextRequest("https://eve.example/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://eve.example/login");
  });

  it("redirects to the configuration error when the production password is missing", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", "");

    const response = await proxy(new NextRequest("https://eve.example/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://eve.example/login?error=configuration",
    );
  });

  it("allows a valid signed session", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);
    const token = await createSessionToken({
      password: parseAccessPassword(ACCESS_PASSWORD),
    });
    const response = await proxy(
      new NextRequest("https://eve.example/", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
