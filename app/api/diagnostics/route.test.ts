import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, parseAccessPassword, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { GET } from "./route";

const ACCESS_PASSWORD = "correct horse battery staple";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/diagnostics", () => {
  it("allows Vercel Preview without a cookie", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");

    const response = await GET(new NextRequest("https://eve.example/api/diagnostics"));
    const report = await response.json();

    expect(response.status).toBe(200);
    expect(report.configuration.accessProtection).toBe("preview");
  });

  it("rejects requests without the signed session cookie", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);

    const response = await GET(new NextRequest("https://eve.example/api/diagnostics"));

    expect(response.status).toBe(401);
  });

  it("returns a secret-free support report for the owner", async () => {
    vi.stubEnv("EVE_ACCESS_PASSWORD", ACCESS_PASSWORD);
    vi.stubEnv("VERCEL", "1");
    const token = await createSessionToken({ password: parseAccessPassword(ACCESS_PASSWORD) });
    const request = new NextRequest("https://eve.example/api/diagnostics", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    const response = await GET(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toMatchObject({ status: "healthy", version: 1 });
    expect(body).not.toContain(ACCESS_PASSWORD);
  });
});
